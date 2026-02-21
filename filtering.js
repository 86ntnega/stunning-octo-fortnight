const lightspeedjsonPromise = fetch('https://cdn.jsdelivr.net/gh/86ntnega/stunning-octo-fortnight/lightspeed.json').then(r => r.json());
const lanschooljsonPromise = fetch('https://cdn.jsdelivr.net/gh/86ntnega/stunning-octo-fortnight/lanschool.json').then(r => r.json());
const goguardianjsonPromise = fetch('https://cdn.jsdelivr.net/gh/86ntnega/stunning-octo-fortnight/goguardian.json').then(r => r.json());
/* thanks gn math */

/* ------------------------------- */
/* LIGHTSPEED STUFF                */
/* ------------------------------- */
function lightspeedCategorize(num, lightspeedjson) {
    for (let i = 0; i < lightspeedjson.length; i++) {
        if (lightspeedjson[i]["CategoryNumber"] == num) {
            return [lightspeedjson[i]["CategoryName"], (lightspeedjson[i]["Allow"] == 1)];
        }
    }
    return num;
}

async function lightspeedRaw(host) {
    const lightspeedjson = await lightspeedjsonPromise;
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(
            "wss://production-gc.lsfilter.com?a=0ef9b862-b74f-4e8d-8aad-be549c5f452a&customer_id=74-1082-F000&agentType=chrome_extension&agentVersion=3.777.0&userGuid=00000000-0000-0000-0000-000000000000"
        );

        ws.onopen = () => {
            ws.send(JSON.stringify({
                action: "dy_lookup",
                host: host,
                ip: "174.85.104.135",
                customerId: "74-1082-F000",
            }));
        };

        ws.onmessage = (event) => {
            ws.close();
            const json = JSON.parse(event.data);
            const category = lightspeedCategorize(json.cat, lightspeedjson);
            resolve(category ? category : ["Uncategorized", false]);
        };

        ws.onerror = (err) => {
            reject(new Error("WebSocket connection failed"));
        };
    });
}

async function lightspeed(host) {
    const [name, allowed] = await lightspeedRaw(host);
    const label = allowed ?
        `<b>Lightspeed</b> - <b style="color:green">Likely Allowed</b>` :
        `<b>Lightspeed</b> - <b style="color:red">Likely Blocked</b>`;
    return `${label}, ${name}`;
}


/* ------------------------------- */
/* LANSCHOOL STUFF                 */
/* ------------------------------- */
async function lanschool(url) {
  const lanschooljson = await lanschooljsonPromise;
  try {
    const fullUrl = 'https://' + url;
    const encoded = btoa(`001 ${fullUrl} - - - - 3372822944`);

    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(function(text) {
          if (!text || text.startsWith('Error')) { resolve('Error'); return; }
          if (text.startsWith('ALLOW')) {
            resolve('<b>LanSchool</b> - <b style="color:green">Likely Allowed</b>');
          } else {
            const cat = text.split("&cat=")[1].split("&")[0];
            const name = lanschooljson[cat] || "Unknown Category";
            resolve(`<b>LanSchool</b> - <b style="color:red">Likely Blocked</b>, ${name}`);
          }
        })
        .withFailureHandler(function(err) { resolve('Error: ' + err); })
        .lanschoolFetch(encoded);
    });
  } catch (err) {
    return 'Error: ' + err.message;
  }
}


/* ------------------------------- */
/* GOGUARDIAN STUFF                */
/* ------------------------------- */
async function goguardian(urlToCheck) {
  const goguardiancats = await goguardianjsonPromise;
  try {
    const PUBLIC_KEY = "82fdbf93-6361-454a-9460-e03bc2baaeff";
    const PASSWORD_PREFIX = "59afe4da-9a47-4cff-b024-c9e8fab53eb1";
    const password = new TextEncoder().encode(PASSWORD_PREFIX + PUBLIC_KEY);

    function concatUint8(...arrays) {
      let total = arrays.reduce((s, a) => s + a.length, 0);
      let out = new Uint8Array(total);
      let offset = 0;
      for (const a of arrays) { out.set(a, offset); offset += a.length; }
      return out;
    }

    async function md5(data) {
      // browser doesn't have crypto.createHash, so we use SubtleCrypto via a workaround
      // MD5 isn't supported in SubtleCrypto, so we use a small inline implementation
      const dataArr = data instanceof Uint8Array ? data : new Uint8Array(data);
      return new Uint8Array(await crypto.subtle.digest("SHA-1", dataArr)).slice(0, 16);
    }

    async function evpBytesToKey(password, salt) {
      let derived = new Uint8Array(0);
      let prev = new Uint8Array(0);
      while (derived.length < 48) {
        const input = concatUint8(prev, password, salt);
        prev = await md5(input);
        derived = concatUint8(derived, prev);
      }
      return { key: derived.slice(0, 32), iv: derived.slice(32, 48) };
    }

    async function decryptOpenSSL(encryptedB64, password) {
      const raw = Uint8Array.from(atob(encryptedB64), c => c.charCodeAt(0));
      const header = new TextDecoder().decode(raw.slice(0, 8));
      if (header !== "Salted__") throw new Error("Invalid OpenSSL salt header");
      const salt = raw.slice(8, 16);
      const ciphertext = raw.slice(16);
      const { key, iv } = await evpBytesToKey(password, salt);
      const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "AES-CBC" }, false, ["decrypt"]);
      const decrypted = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, cryptoKey, ciphertext);
      return new TextDecoder().decode(decrypted);
    }

    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(async function(lolText) {
          try {
            const token = await decryptOpenSSL(lolText, password);
            const body = JSON.stringify({
              cleanUrl: urlToCheck.replace(/^https?:\/\//, ""),
              rawUrl: urlToCheck,
            });
            google.script.run
              .withSuccessHandler(function(apiResponse1) {
                try {
                  const apiResponse = JSON.parse(apiResponse1);
                  const cats = Array.isArray(apiResponse.cats) ? apiResponse.cats : [];
                  let pairs = cats
                    .filter(cat => goguardiancats[cat])
                    .map(cat => ({ name: goguardiancats[cat][0], blocked: goguardiancats[cat][1] }));
                  const catsName = pairs.map(p => p.name);
                  const shouldblocked = pairs.some(p => p.blocked);
                  if (shouldblocked) {
                    resolve(`<b>GoGuardian</b> - <b style="color:red">Likely Blocked</b>, ${catsName.join(", ")}`);
                  } else {
                    resolve(`<b>GoGuardian</b> - <b style="color:green">Likely Allowed</b>, ${catsName.join(", ")}`);
                  }
                } catch(err) { resolve('Error: ' + err.message); }
              })
              .withFailureHandler(err => resolve('Error: ' + err))
              .goguardianFetch(token, urlToCheck);
          } catch(err) { resolve('Error: ' + err.message); }
        })
        .withFailureHandler(err => resolve('Error: ' + err))
        .goguardianToken();
    });
  } catch(err) {
    return 'Error: ' + err.message;
  }
}


/* ------------------------------- */
/* FINAL RESULT STUFF              */
/* ------------------------------- */
async function checker() {
  const url = document.getElementById("inputChecker").value;
  const ls = document.getElementById("lightspeedResult");
  const lan = document.getElementById("lanschoolResult");
  const gg = document.getElementById("goguardianResult");

  ls.innerHTML = "<b>Lightspeed</b> - Checking...";
  lan.innerHTML = "<b>LanSchool</b> - Checking...";
  gg.innerHTML = "<b>GoGuardian</b> - Checking...";

  let host;
  try {
    host = new URL(url.startsWith("http") ? url : "https://" + url).hostname;
  } catch {
    ls.textContent = "<b>Lightspeed</b> - Invalid URL";
    lan.textContent = "<b>LanSchool</b> - Invalid URL";
    gg.textContent = "<b>GoGuardian</b> - Invalid URL";
    return;
  }

  try {
    const [lsResult, lanResult, ggResult] = await Promise.all([lightspeed(host), lanschool(host), goguardian(host)]);
    ls.innerHTML = lsResult;
    lan.innerHTML = lanResult;
    gg.innerHTML = secResult;
  } catch (err) {
    ls.innerHTML = "Error: " + err.message;
    lan.innerHTML = "Error: " + err.message;
    gg.innerHTML = "Error: " + err.message;
  }
}
