import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js?v=12';
let client;
export const cloud={
 ready:Boolean(SUPABASE_URL&&SUPABASE_ANON_KEY),
 async init(){if(!this.ready)return null;const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2');client=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);const {data,error}=await client.auth.getSession();if(error)throw error;return data.session;},
 watch(fn){client?.auth.onAuthStateChange((event,session)=>{if(['SIGNED_IN','SIGNED_OUT','PASSWORD_RECOVERY'].includes(event))setTimeout(()=>fn(session,event),0);});},
 async signIn(email,password){if(!client)throw Error('Нет соединения с сервисом входа');const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;return data.session;},
 async signUp(email,password,profile){if(!client)throw Error('Нет соединения с сервисом входа');const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname,data:profile}});if(error)throw error;return data;},
 async recover(email){if(!client)throw Error('Нет соединения с сервисом входа');const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw error;},
 async password(password){const {error}=await client.auth.updateUser({password});if(error)throw error;},
 async signOut(){const {error}=await client.auth.signOut();if(error)throw error;},
 async pull(userId){const {data,error}=await client.from('app_state').select('data').eq('user_id',userId).maybeSingle();if(error)throw error;return data?.data||null;},
 async push(userId,data){const {error}=await client.from('app_state').upsert({user_id:userId,data,updated_at:new Date().toISOString()});if(error)throw error;}
};
