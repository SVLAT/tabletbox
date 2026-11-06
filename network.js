export function bounded(promise, milliseconds=18000) {
 let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error('Сервер не ответил. Проверьте интернет и повторите попытку.'),{code:'network_timeout'})),milliseconds);})]).finally(()=>clearTimeout(timer));
}
export async function timedFetch(input,init={}) {
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),14000);
 const abort=()=>controller.abort();init.signal?.addEventListener('abort',abort,{once:true});
 if(init.signal?.aborted)controller.abort();
 try{return await fetch(input,{...init,signal:controller.signal});}finally{clearTimeout(timer);init.signal?.removeEventListener('abort',abort);}
}
