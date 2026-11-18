"use strict";
globalThis.SvodCore = (() => {
  const categories = [
    { id:"home", name:"Жильё", icon:"home", color:"#60c9f5", examples:"аренда квартира жилье коммуналка вода свет электричество интернет связь телефон etisalat e& dewa du" },
    { id:"car", name:"Авто", icon:"car", color:"#789bff", examples:"машина автомобиль заправка заправился бензин топливо enoc adnoc мойка помыл шиномонтаж сервис парковка salik салик такси карим uber" },
    { id:"food", name:"Еда", icon:"food", color:"#b4d4f6", examples:"еда обед ужин завтрак ресторан кафе кофе капучино латте бургер пицца продукты супермаркет магазин carrefour lulu viva talabat" },
    { id:"other", name:"Прочее", icon:"other", color:"#8093b2", examples:"подарок одежда подписка кино игры цветы доставка техника" }
  ];
  const normalized = s => s.toLocaleLowerCase("ru").replace(/ё/g,"е").trim();
  function grams(text) {
    const chunks = new Set();
    for (const w of normalized(text).split(/[^a-zа-я0-9&]+/u).filter(Boolean)) {
      chunks.add(w);
      if (w.length >= 3) for(let i=0;i<=w.length-3;i++) chunks.add(w.slice(i,i+3));
    }
    return chunks;
  }
  function similarity(a,b) {
    let common=0;
    for (const g of a) if(b.has(g)) common++;
    return common/Math.sqrt(Math.max(1,a.size*b.size));
  }
  const patterns = [
    ["мойка",/мойк|помыл.*машин|помыла.*машин|автомой/],
    ["заправка",/заправ|бензин|топливо/],["парковка",/парков/],["salik",/salik|салик/],
    ["e&",/e&|етисалат|этисалат|etisalat/],["кофе",/кофе|кофей/]
  ];
  function key(s) {
    const n=normalized(s);
    return patterns.find(([,p])=>p.test(n))?.[0] || n.replace(/(?:как обычно|по обычной цене|дирхам[а-я]*|\baed\b)/gi,"").replace(/\d+(?:[.,]\d+)?/g,"").replace(/[^а-яa-z&]+/g," ").trim();
  }
  function categorize(s,history) {
    const features=grams(s);
    const candidates=categories.flatMap(c=>c.examples.split(" ").map(w=>({c:c.id,score:similarity(features,grams(w))})));
    for(const e of history) candidates.push({c:e.category,score:similarity(features,grams(e.name))*1.25});
    candidates.sort((a,b)=>b.score-a.score);
    return candidates[0]?.score>.21?candidates[0].c:"other";
  }
  function day(d=new Date()) { return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-"); }
  const local = iso => new Date(iso+"T12:00:00");
  function offsetDate(iso,n) {const d=local(iso);d.setDate(d.getDate()+n);return day(d);}
  const weekdays=["воскресенье","понедельник","вторник","среду","четверг","пятницу","субботу"];
  function resolveDate(text,base) {
    const t=normalized(text);if(t.includes("послезавтра")) return offsetDate(base,2);
    if(t.includes("завтра"))return offsetDate(base,1);if(t.includes("вчера"))return offsetDate(base,-1);
    const w=weekdays.findIndex(x=>t.includes("в "+x)||t.includes("во "+x));return w<0?base:offsetDate(base,(w-local(base).getDay()+7)%7||7);
  }
  const timing=/(?:послезавтра|завтра|вчера|сегодня|(?:в|во)\s+(?:воскресенье|понедельник|вторник|среду|четверг|пятницу|субботу))/giu;
  const verbs=/^(?:(?:мне\s+)?надо|нужно|напомни|задача|позвони(?:ть)?|запиши(?:сь|ться)?|оплати(?:ть)?|заплати(?:ть)?|купи(?:ть)?|забери|забрать|отправь|отправить|проверь|проверить|заехать|заедь|сходить|сделать|пополнить|пополн[иь])(?:\s|$)/iu;
  const nums={"ноль":0,"один":1,"одна":1,"два":2,"две":2,"три":3,"четыре":4,"пять":5,"шесть":6,"семь":7,"восемь":8,"девять":9,"десять":10,"одиннадцать":11,"двенадцать":12,"тринадцать":13,"четырнадцать":14,"пятнадцать":15,"шестнадцать":16,"семнадцать":17,"восемнадцать":18,"девятнадцать":19,"двадцать":20,"тридцать":30,"сорок":40,"пятьдесят":50,"шестьдесят":60,"семьдесят":70,"восемьдесят":80,"девяносто":90,"сто":100,"двести":200,"триста":300,"четыреста":400,"пятьсот":500,"шестьсот":600,"семьсот":700,"восемьсот":800,"девятьсот":900};
  function normalizeNumbers(s) {
    let amount=0,thousands=0,seen=false;const out=[];
    function flush(){if(seen)out.push(String(amount+thousands));amount=0;thousands=0;seen=false;}
    for(const token of s.split(/\s+/)){if(Object.hasOwn(nums,token)){amount+=nums[token];seen=true;}else if(/^тысяч(?:а|и)?$/.test(token)){thousands+=(amount||1)*1000;amount=0;seen=true;}else{flush();out.push(token);}}
    flush();return out.join(" ");
  }
  function parse(text,base,history=[]) {
    const pieces=normalized(text).replace(/[,;.!?]+$/g,"").split(/(?:[;\n]+|\s+и\s+(?=(?:завтра|сегодня|послезавтра|в пятницу|позвони|оплати|надо|напомни|купи|заправ|мойк|кофе|задача))|,\s*(?=(?:завтра|напомни|позвони|задача)))/iu);
    return pieces.map(piece=>{
      const date=resolveDate(piece,base);
      let name=piece.replace(timing,"").replace(/^[\s,.]+|[\s,.]+$/g,"");
      const isTask=verbs.test(name);
      name=normalizeNumbers(name);
      const match=name.match(/(?:^|[^\d])(\d{1,3}(?:[ \u00a0]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?!\d)/);
      const cents=match?Math.round(Number(match[1].replace(/\s/g,"").replace(",","."))*100):null;
      const predicted=categorize(name,history);
      const old=[...history].reverse().find(e=>key(e.name)&&key(e.name)===key(name));
      const isExpense=!isTask&&(cents!==null||Boolean(old)||(/^[^\s]+(?:\s+как обычно)?$/u.test(name)&&predicted!=="other")||/потрат|купил|оплатил|мойк|заправ|помыл|как обычно|расход/i.test(name));
      if(isExpense){
        if(match)name=name.replace(match[1],"");
        name=name.replace(/дирхам[а-я]*|(?:^|\s)aed(?:$|\s)|как обычно|по обычной цене/giu,"").replace(/(?:\s+(?:на|за)|[,.: -])+$/u,"").trim();
        if(!name)name="Расход";
      } else name=name.replace(/^(?:задача|напомни(?: мне)?|мне надо|нужно)[: ,]+/u,"");
      return {type:isExpense?"expense":"task",name:name.charAt(0).toUpperCase()+name.slice(1),date,category:old?.category||predicted,cents:isExpense?(cents??old?.cents??null):null};
    }).filter(x=>x.name);
  }
  return {categories,day,local,offsetDate,key,categorize,parse};
})();
