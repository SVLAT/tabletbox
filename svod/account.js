"use strict";
globalThis.SvodAccounts = (() => {
  const groups = ["expenses", "tasks"];
  const prefix = "svod.v1.";
  const empty = () => ({version: 1, expenses: [], tasks: []});

  function validRow(group, row) {
    if (!row || typeof row.id !== "string" || !/^[a-zA-Z0-9_-]{1,120}$/.test(row.id)) return false;
    if (typeof row.name !== "string" || !row.name.trim() || row.name.length > 180) return false;
    if (typeof row.date !== "string" || !/^\d{4}-\d\d-\d\d$/.test(row.date)) return false;
    if (group === "tasks") return typeof row.done === "boolean";
    return ["home","car","food","other"].includes(row.category) && Number.isSafeInteger(row.cents) && row.cents > 0;
  }

  function connect(sdk, user) {
    if (!user?.uuid || user.is_temp) throw Error("Для синхронизации нужен постоянный аккаунт Puter.");
    const token = sdk.authToken;
    const ownPrefix = prefix + user.uuid + ".";
    let closed = false;
    function check() {
      if (closed || !sdk.auth.isSignedIn() || sdk.authToken !== token) {
        throw Error("Сеанс завершён. Войди в свой аккаунт ещё раз.");
      }
    }
    async function read() {
      check();
      const rows = await sdk.kv.list(ownPrefix + "*", true);
      check();
      if (!Array.isArray(rows)) throw Error("Не удалось загрузить записи.");
      const state = empty();
      for (const {key,value} of rows) {
        const [group,id] = key.slice(ownPrefix.length).split(".");
        if (!key.startsWith(ownPrefix) || !groups.includes(group) || !validRow(group,value) || id !== value.id) {
          throw Error("Не удалось прочитать одну из сохранённых записей.");
        }
        state[group].push(value);
      }
      for (const group of groups) state[group].sort((a,b)=>(a.createdAt||0)-(b.createdAt||0)||a.id.localeCompare(b.id));
      return state;
    }
    async function save(before, after) {
      check();
      const puts = [], deletes = [];
      for (const group of groups) {
        const previous = new Map(before[group].map(row=>[row.id,row]));
        for (const row of after[group]) {
          if (!validRow(group,row)) throw Error("Проверь название, дату и сумму записи.");
          const old = previous.get(row.id);
          if (JSON.stringify(old) !== JSON.stringify(row)) {
            row.createdAt ??= old?.createdAt ?? Date.now();
            puts.push({key:ownPrefix+group+"."+row.id, value:row});
          }
          previous.delete(row.id);
        }
        for (const id of previous.keys()) deletes.push(ownPrefix+group+"."+id);
      }
      // Each editor operation is a single write, including a multi-item voice entry.
      if ((puts.length && deletes.length) || deletes.length > 1) throw Error("Сохрани изменения по отдельности.");
      if (deletes.length) await sdk.kv.del(deletes[0]);
      else if (puts.length) {
        const saved = puts.length===1 ? await sdk.kv.set(puts[0].key, puts[0].value, {disableSharing:true})
          : await sdk.kv.set(puts, {disableSharing:true});
        if (saved===false) throw Error("Облако не подтвердило сохранение.");
      }
      check();
    }
    return {user, read, save, check, close(){closed=true;}};
  }
  return {connect, empty, validRow};
})();
