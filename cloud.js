import {connect} from './puter-store.js?v=16';
import {bounded} from './network.js?v=14';
const marker='tabletbox.puter.active.v1',watchers=new Set();let account=null,generation=0;
const mark=value=>{if(value)localStorage.setItem(marker,value);else localStorage.removeItem(marker);};
const session=()=>account?{user:{id:account.user.uuid,username:account.user.username,email:account.user.email||'',user_metadata:{displayName:account.user.username}},provider:'puter'}:null;
function publish(){const s=session();for(const fn of watchers)setTimeout(()=>Promise.resolve(fn(s)).catch(()=>{}),0);return s;}
function sdk(){if(!globalThis.puter?.auth)throw Error('Puter ещё не загрузился. Проверьте интернет и обновите страницу.');return globalThis.puter;}
function ready(){if(globalThis.puter?.auth)return Promise.resolve();return bounded(new Promise((resolve,reject)=>{const script=document.getElementById('identitySDK');script.addEventListener('load',()=>globalThis.puter?.auth?resolve():reject(Error('Не удалось подключить Puter')),{once:true});script.addEventListener('error',()=>reject(Error('Не удалось загрузить Puter')),{once:true});}),15000);}
export const cloud={
 ready:true,watch(fn){watchers.add(fn);return()=>watchers.delete(fn);},
 async init(){await ready();const p=sdk(),saved=localStorage.getItem(marker);if(!saved||!p.auth.isSignedIn())return null;const stamp=++generation,user=await bounded(p.auth.getUser());if(stamp!==generation)return null;if(user.uuid!==saved){mark(null);return null;}account=connect(p,user);return session();},
 async signIn(){const p=sdk(),stamp=++generation;/* Call from the user's click before any await: Safari popup requirement. */const login=p.auth.signIn({attempt_temp_user_creation:false,request_auth:true});await bounded(login,120000);if(stamp!==generation)throw Object.assign(Error('Вход отменён'),{code:'auth_window_closed'});const user=await bounded(p.auth.getUser());if(stamp!==generation)throw Error('Вход отменён');account?.close();account=connect(p,user);mark(user.uuid);return session();},
 cancel(){generation++;},
 async signOut(){generation++;const owner=account?.user.uuid;account?.close();account=null;if(!owner||localStorage.getItem(marker)===owner)mark(null);publish();},
 async refresh(){if(!account)return;const p=sdk();if(!p.auth.isSignedIn()||localStorage.getItem(marker)!==account.user.uuid){await this.signOut();return;}try{account.check();}catch{await this.signOut();}},
 async pull(id){if(!account||account.user.uuid!==id)throw Error('Войдите в свой аккаунт Puter');return account.read();},
 async push(id,data){if(!account||account.user.uuid!==id)throw Error('Войдите в свой аккаунт Puter');return account.write(data);}
};
