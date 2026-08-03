import crypto from 'node:crypto';

const ACTIVE_STATUSES=new Set(['active','trialing']);

function form(obj){
  const p=new URLSearchParams();
  for(const [k,v] of Object.entries(obj)) if(v!==undefined&&v!==null&&v!=='') p.append(k,String(v));
  return p;
}

export class StripeBilling {
  constructor({store,secretKey,priceId,webhookSecret,apiBase='https://api.stripe.com/v1'}){
    this.store=store;this.secretKey=secretKey||'';this.priceId=priceId||'';this.webhookSecret=webhookSecret||'';this.apiBase=apiBase.replace(/\/$/,'');
  }
  get configured(){return Boolean(this.secretKey&&this.priceId&&this.webhookSecret)}
  async request(path,fields){
    if(!this.secretKey)throw Object.assign(new Error('Stripe secret key is not configured'),{code:'STRIPE_NOT_CONFIGURED'});
    const r=await fetch(this.apiBase+path,{method:'POST',headers:{authorization:`Bearer ${this.secretKey}`,'content-type':'application/x-www-form-urlencoded'},body:form(fields)});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw Object.assign(new Error(d?.error?.message||`Stripe API ${r.status}`),{code:d?.error?.code||'STRIPE_API_ERROR',status:r.status});
    return d;
  }
  async createCheckout(user,origin){
    if(!this.priceId)throw Object.assign(new Error('Stripe price is not configured'),{code:'STRIPE_NOT_CONFIGURED'});
    const fields={
      mode:'subscription',
      'line_items[0][price]':this.priceId,
      'line_items[0][quantity]':1,
      success_url:`${origin}/?billing=success&session_id={CHECKOUT_SESSION_ID}#billing`,
      cancel_url:`${origin}/?billing=cancelled#billing`,
      client_reference_id:user.id,
      'metadata[user_id]':user.id,
      'subscription_data[metadata][user_id]':user.id,
      allow_promotion_codes:'true'
    };
    if(user.stripeCustomerId)fields.customer=user.stripeCustomerId;
    return this.request('/checkout/sessions',fields);
  }
  async createPortal(user,origin){
    if(!user.stripeCustomerId)throw Object.assign(new Error('No Stripe customer exists for this account'),{code:'NO_STRIPE_CUSTOMER',status:409});
    return this.request('/billing_portal/sessions',{customer:user.stripeCustomerId,return_url:`${origin}/#billing`});
  }
  verify(raw,header,tolerance=300){
    if(!this.webhookSecret)throw Object.assign(new Error('Webhook secret is not configured'),{code:'STRIPE_NOT_CONFIGURED'});
    const parts=Object.fromEntries(String(header||'').split(',').map(x=>x.split('=',2)));
    const t=Number(parts.t),sig=parts.v1;
    if(!Number.isFinite(t)||!sig)throw Object.assign(new Error('Invalid Stripe signature header'),{code:'BAD_SIGNATURE'});
    if(Math.abs(Date.now()/1000-t)>tolerance)throw Object.assign(new Error('Stripe signature timestamp outside tolerance'),{code:'BAD_SIGNATURE'});
    const expected=crypto.createHmac('sha256',this.webhookSecret).update(`${t}.${raw}`).digest('hex');
    const a=Buffer.from(expected,'hex'),b=Buffer.from(sig,'hex');
    if(a.length!==b.length||!crypto.timingSafeEqual(a,b))throw Object.assign(new Error('Stripe signature verification failed'),{code:'BAD_SIGNATURE'});
  }
  processEvent(event){
    if(!event?.id||!event?.type)throw new Error('Malformed Stripe event');
    if(this.store.hasStripeEvent(event.id))return {duplicate:true};
    const o=event.data?.object||{};
    let user=null;
    const uid=o.metadata?.user_id||o.client_reference_id;
    if(uid)user=this.store.user(uid);
    if(!user&&o.customer)user=this.store.findUserByStripeCustomer(o.customer);
    switch(event.type){
      case 'checkout.session.completed':
        if(user)this.store.updateBilling(user.id,{stripeCustomerId:o.customer||user.stripeCustomerId,stripeSubscriptionId:o.subscription||user.stripeSubscriptionId,subscriptionStatus:'processing'});
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        if(!user&&o.metadata?.user_id)user=this.store.user(o.metadata.user_id);
        if(user){
          const status=event.type.endsWith('.deleted')?'canceled':(o.status||'unknown');
          const priceMatches=event.type.endsWith('.deleted')||Boolean(o.items?.data?.some(item=>item?.price?.id===this.priceId));
          const entitled=ACTIVE_STATUSES.has(status)&&priceMatches;
          const periodEnd=o.current_period_end?new Date(o.current_period_end*1000).toISOString():null;
          this.store.updateBilling(user.id,{stripeCustomerId:o.customer||user.stripeCustomerId,stripeSubscriptionId:o.id||user.stripeSubscriptionId,subscriptionStatus:status,currentPeriodEnd:periodEnd,cancelAtPeriodEnd:Boolean(o.cancel_at_period_end),liveEntitled:entitled,plan:entitled?'pro':'free'});
        }
        break;
      }
      case 'invoice.payment_failed':
        if(user)this.store.updateBilling(user.id,{subscriptionStatus:'past_due',liveEntitled:false,plan:'free'});
        break;
      case 'invoice.paid':
        break;
      default: break;
    }
    this.store.recordStripeEvent(event.id,event.type);
    return {processed:true,userId:user?.id||null};
  }
}

export function stripeSignature(raw,secret,t=Math.floor(Date.now()/1000)){
  const v1=crypto.createHmac('sha256',secret).update(`${t}.${raw}`).digest('hex');return `t=${t},v1=${v1}`;
}
