const lightspeedjsonPromise = fetch('https://cdn.jsdelivr.net/gh/86ntnega/stunning-octo-fortnight/lightspeed.json').then(r => r.json());
const lanschooljsonPromise = fetch('https://cdn.jsdelivr.net/gh/86ntnega/stunning-octo-fortnight/lanschool.json').then(r => r.json());
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
            resolve('LanSchool - <b style="color:green">Likely Allowed</b>');
          } else {
            const cat = text.split("&cat=")[1].split("&")[0];
            const name = lanschooljson[cat] || "Unknown Category";
            resolve(`LanSchool - <b style="color:red">Likely Blocked</b>, ${name}`);
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
/* FINAL RESULT STUFF              */
/* ------------------------------- */
async function checker() {
  const url = document.getElementById("inputChecker").value;
  const ls = document.getElementById("lightspeedResult");
  const lan = document.getElementById("lanschoolResult");

  ls.innerHTML = "Checking...";
  lan.innerHTML = "Checking...";

  let host;
  try {
    host = new URL(url.startsWith("http") ? url : "https://" + url).hostname;
  } catch {
    ls.textContent = "Invalid URL";
    lan.textContent = "Invalid URL";
    return;
  }

  try {
    const [lsResult, lanResult] = await Promise.all([lightspeed(host), lanschool(host)]);
    ls.innerHTML = lsResult;
    lan.innerHTML = lanResult;
  } catch (err) {
    ls.innerHTML = "Error: " + err.message;
    lan.innerHTML = "Error: " + err.message;
  }
}
