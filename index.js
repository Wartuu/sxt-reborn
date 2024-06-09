const { default: axios } = require('axios');
const express = require('express');
const app = express();
const port = 8081;

const jsdom = require('jsdom');
const {JSDOM} = jsdom;

const zsl_url = "https://zsl.gliwice.pl/planlekcji/tech/plany/o15.html";
const gzm_url = "http://sdip.transportgzm.pl/main?command=planner&action=sd&id=";

// searching from: https://sdip.transportgzm.pl/main?command=planner&action=sd&id=8399
// to: https://sdip.transportgzm.pl/main?command=planner&action=sd&id=8408
const gzmBegin = 8399
const gzmEnd = 8408


const vulkanRegex = /<table\b[^>]*class="tabela"[^>]*>((?:.|\n)*?)<\/table>/gis;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

var zsl;
var gzm;

//chatgpt can generate hard regex




updateZSL();
updateGZM();
setInterval(
    () => {
        updateZSL()
    },
    1000*60*60
)

setInterval(() => {
    updateGZM()
}, 1000 * 60);


app.set('view engine', 'ejs');
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.render('index', {zsl: zsl, gzm: gzm});
})



app.listen(port, () => {
    console.log("listening at: http://127.0.0.1:" + port + "/");
})

async function updateZSL() {
    try {
        const response = (await axios.get(zsl_url)).data;
        const tables = response.match(/<table.+?<\/table>/gs);
        
        if (!tables) {
            console.log("No tables found in the response.");
            return;
        }

        var classname = tables[0];
        var schedule = tables[1];

        const dom = new JSDOM(schedule);
        const document = dom.window.document;

        const inlineStyles = document.querySelectorAll('[style]');
        inlineStyles.forEach(el => {
            el.removeAttribute('style')
        });

        const inlineHref = document.querySelectorAll('[href]');
        inlineHref.forEach(el => {
            el.removeAttribute('href');
        })

        const table = document.querySelector('table.tabela');
        const rows = table.querySelectorAll('tr');

        rows.forEach(el => {
            const details = el.querySelectorAll('a');
            details.forEach(detail => detail.remove());
        })

        var updatedZSL = "";
        rows.forEach(row => {
            updatedZSL += "<tr>" + row.innerHTML + "</tr>";
        })

        zsl = updatedZSL;

    } catch (error) {
        console.error("Error: ", error);
    }
}



async function updateGZM() {
    try {
        var newGzm = "";

        var departures = [];
        for(let i = gzmEnd; i >= gzmBegin; i--) {
            let positionDeparture = await requestGZM(gzm_url + i);

            if(positionDeparture === undefined) {
                return;
            }

            departures.push(...positionDeparture)
        }
    
        departures.sort((a, b) => {
            const timeA = timeToInt(a.time);
            const timeB = timeToInt(b.time);
            return timeA - timeB;
        })
    
        departures = departures.slice(0, 15);
    
        departures.forEach(departure => {
            newGzm += `<tr> <td>${departure.line}</td> <td>${departure.destination}</td> <td>${departure.time}</td></tr>`
        })
    
        gzm = newGzm;
    } catch (error) {
        console.error("Error: ", error);
    }

}

async function requestGZM(url) {
    try {
        const response = await axios.get(url);
        const dom = new JSDOM(response.data);
        const document = dom.window.document;
    
        const rows = document.querySelector(".rows");
        const departures = rows.querySelectorAll(".departure");
    
        var output = [];
    
        departures.forEach(departure => {
    
            const line = departure.querySelector('.line').innerHTML;
            const destination = departure.querySelector('.destination').innerHTML;
            const time = departure.querySelector('.time').innerHTML;
            output.push({line, destination, time})
        });
    
        return output;
    } catch (error) {
        console.error("Error: ", error)
        return undefined;
    }
}

function timeToInt(strTime) {
    if(strTime === undefined) return;
    if(strTime.includes("min")) {
        return parseInt(strTime.split(" ")[0]);
    } else {
        const parts = strTime.split(":");
        const hours = parseInt(parts[0]);
        const minutes = parseInt(parts[1]);
        return hours * 60 + minutes;
    }
}