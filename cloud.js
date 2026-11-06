import {SUPABASE_URL,SUPABASE_ANON_KEY} from './supabase-config.js?v=12';
import {bounded,timedFetch} from './network.js?v=14';
let client,preparing;const watchers=new Set();
async function prepare(){
 if(client)return client;
 if(!preparing)preparing=bounded(import('https://esm.sh/@supabase/supabase-js@2')).then(({createClient})=>{client=createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage},global:{fetch:timedFetch}});client.auth.onAuthStateChange((event,session)=>{if(['SIGNED_IN','SIGNED_OUT','PASSWORD_RECOVERY','TOKEN_REFRESHED','USER_UPDATED'].includes(event))for(const fn of watchers)setTimeout(()=>{Promise.resolve(fn(session,event)).catch(()=>{});},0);});return client;}).catch(e=>{preparing=null;throw e;});
 return preparing;
}
async function auth(method,...args){const c=await prepare();const result=await bounded(c.auth[method](...args));if(result.error)throw result.error;return result.data;}
export const cloud={
 ready:!!(SUPABASE_URL&&SUPABASE_ANON_KEY),
 async init(){if(!this.ready)return null;return (await auth('getSession')).session;},
 watch(fn){watchers.add(fn);return()=>watchers.delete(fn);},
 async signIn(email,password){return(await auth('signInWithPassword',{email,password})).session;},
 async signUp(email,password,profile){return auth('signUp',{email,password,options:{emailRedirectTo:location.origin+location.pathname,data:profile}});},
 async recover(email){return auth('resetPasswordForEmail',email,{redirectTo:location.origin+location.pathname});},
 async password(password){return auth('updateUser',{password});},
 async signOut(){return auth('signOut',{scope:'local'});},
 async pull(userId){const c=await prepare();const {data,error}=await bounded(c.from('app_state').select('data').eq('user_id',userId).maybeSingle());if(error)throw error;return data?.data||null;},
 async push(userId,data){const c=await prepare();const {error}=await bounded(c.from('app_state').upsert({user_id:userId,data,updated_at:new Date().toISOString()}));if(error)throw error;}
};
