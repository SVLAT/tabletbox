"use strict";
globalThis.SvodVoice = (() => {
  const workerSource = `
    import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js";
    env.allowLocalModels = false;
    env.backends.onnx.wasm.numThreads = 1;
    env.backends.onnx.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/";
    self.onmessage = async ({data}) => {
      try {
        let last = 0;
        const loaded = new Map();
        const transcribe = await pipeline("automatic-speech-recognition","Xenova/whisper-tiny", {
          quantized: true,
          progress_callback(event) {
            if (event.status !== "progress") return;
            loaded.set(event.file, event.loaded || 0);
            if (Date.now() - last < 500) return;
            last = Date.now();
            self.postMessage({stage:"loading",mb:Math.round([...loaded.values()].reduce((a,b)=>a+b,0)/1048576)});
          }
        });
        self.postMessage({stage:"reading"});
        const result = await transcribe(data,{language:"russian",task:"transcribe",chunk_length_s:25,stride_length_s:4,do_sample:false});
        self.postMessage({stage:"done",text:result.text.trim()});
      } catch { self.postMessage({stage:"failed"}); }
    };
  `;

  async function samples(blob) {
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Offline) throw Error("Этот браузер не поддерживает обработку аудио. Запись можно прослушать и скачать.");
    const context = new Offline(1, 1, 16000);
    const audio = await context.decodeAudioData(await blob.arrayBuffer());
    if (audio.sampleRate !== 16000) throw Error("Не удалось подготовить запись для расшифровки.");
    const pcm = new Float32Array(audio.length);
    for (let i = 0; i < audio.numberOfChannels; i++) {
      const channel = audio.getChannelData(i);
      for (let j = 0; j < pcm.length; j++) pcm[j] += channel[j] / audio.numberOfChannels;
    }
    let peak = 0;
    for (const sample of pcm) peak = Math.max(peak, Math.abs(sample));
    if (pcm.length < 2400 || peak < 0.002) throw Error("Запись слишком тихая или короткая. Попробуй сказать фразу ещё раз.");
    return pcm;
  }

  function session({status, phase, clip, transcript}) {
    let alive=true, recorder, stream, timer, worker, workerURL, audioURL, watchdog, lastBlob;
    let state="idle",attempt=0;
    function setState(value) {state=value;phase(value);}
    function releaseMic() {
      clearInterval(timer);
      stream?.getTracks().forEach(track=>track.stop());
      stream=null;
    }
    function releaseWorker() {
      clearTimeout(watchdog);
      worker?.terminate();worker=null;
      if(workerURL)URL.revokeObjectURL(workerURL);
      workerURL=null;
    }
    function fail(text) {
      if(!alive)return;
      releaseWorker();setState(lastBlob?"retry":"idle");status(text);
    }
    async function transcribe(){
      if(!alive||!lastBlob||state==="processing")return;
      setState("processing");status("Подготавливаю запись…");
      try {
        const pcm=await samples(lastBlob);
        if(!alive)return;
        status("Загружаю модель речи. В первый раз понадобится интернет.");
        workerURL=URL.createObjectURL(new Blob([workerSource],{type:"text/javascript"}));
        worker=new Worker(workerURL,{type:"module"});
        const rearm=()=>{clearTimeout(watchdog);watchdog=setTimeout(()=>fail("Расшифровка заняла слишком много времени. Запись доступна для повтора."),180000);};
        worker.onmessage=({data})=>{
          if(!alive)return;
          rearm();
          if(data.stage==="loading")status("Загрузка модели речи… "+data.mb+" МБ");
          else if(data.stage==="reading")status("Распознаю речь на устройстве…");
          else if(data.stage==="done"){
            releaseWorker();
            if(!data.text){fail("Речь не распознана. Прослушай запись или запиши ещё раз.");return;}
            setState("ready");status("Проверь текст перед сохранением.");transcript(data.text);
          } else fail("Не удалось загрузить модель или распознать речь. Можно повторить или скачать аудио.");
        };
        worker.onerror=()=>fail("Модель речи недоступна. Проверь интернет и повтори расшифровку.");
        rearm();worker.postMessage(pcm,[pcm.buffer]);
      } catch(e) {fail(e.message||"Не удалось обработать запись.");}
    }
    function stop(){
      if(recorder?.state!=="recording")return;
      setState("stopping");status("Завершаю запись…");
      try{recorder.stop();}catch{releaseMic();fail("Не удалось завершить запись. Попробуй ещё раз.");}
    }
    async function start(){
      if(!alive||!["idle","retry","ready"].includes(state))return;
      if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){
        fail("Для записи открой «Свод» в Safari по HTTPS и разреши доступ к микрофону.");return;
      }
      const token=++attempt;
      setState("requesting");status("Ожидаю доступ к микрофону…");
      try {
        const granted=await navigator.mediaDevices.getUserMedia({audio:true});
        if(!alive||token!==attempt){granted.getTracks().forEach(t=>t.stop());return;}
        stream=granted;
        const Recorder=window.MediaRecorder;
        const mime=["audio/mp4","audio/webm;codecs=opus","audio/webm"].find(type=>Recorder.isTypeSupported?.(type));
        recorder=mime?new Recorder(stream,{mimeType:mime}):new Recorder(stream);
        const active=recorder,chunks=[];
        active.ondataavailable=({data})=>{if(data?.size)chunks.push(data);};
        active.onerror=()=>{active.onstop=null;releaseMic();fail("Запись прервалась. Можно начать заново.");};
        active.onstop=()=>{
          releaseMic();
          if(!alive||token!==attempt)return;
          const blob=new Blob(chunks,{type:active.mimeType||chunks[0]?.type||"audio/mp4"});
          if(!blob.size){fail("Микрофон вернул пустую запись. Попробуй ещё раз.");return;}
          if(audioURL)URL.revokeObjectURL(audioURL);
          lastBlob=blob;audioURL=URL.createObjectURL(blob);clip(audioURL,blob.type);
          transcribe();
        };
        active.start();setState("recording");
        const since=Date.now();
        function tick(){const sec=Math.floor((Date.now()-since)/1000);status("Идёт запись · "+Math.floor(sec/60)+":"+String(sec%60).padStart(2,"0"));if(sec>=60)stop();}
        tick();timer=setInterval(tick,400);
      } catch(e) {releaseMic();fail(e.name==="NotAllowedError"?"Доступ к микрофону закрыт. Разреши его для «Свода» в настройках сайта.":"Микрофон недоступен. Проверь подключение и попробуй ещё раз.");}
    }
    function dispose(){
      alive=false;attempt++;
      if(recorder){recorder.onstop=null;recorder.onerror=null;recorder.ondataavailable=null;if(recorder.state==="recording")try{recorder.stop();}catch{}}
      releaseMic();releaseWorker();if(audioURL)URL.revokeObjectURL(audioURL);
    }
    return {start,stop,transcribe,dispose};
  }
  return {session};
})();
