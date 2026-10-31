
//moduly
require("dotenv").config();
const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const jwt = require("jsonwebtoken");

//express
const xprs = express();
//config basic
const PORT = process.env.PORT || 25133;
const ver = "3.43.0";
const appver = "1.82.206.1";
const debugging = process.env.DEBUG || undefined;

//barvicky
const colors = {
    "black": "\u001b[30m",
    "red": "\u001b[31m",
    "green": "\u001b[32m",
    "yellow": "\u001b[33m",
    "blue": "\u001b[34m",
    "magenta": "\u001b[35m",
    "cyan": "\u001b[36m",
    "white": "\u001b[37m",
    "bright_black": "\u001b[90m",
    "bright_red": "\u001b[91m",
    "bright_green": "\u001b[92m",
    "bright_yellow": "\u001b[93m",
    "bright_blue": "\u001b[94m",
    "bright_magenta": "\u001b[95m",
    "bright_cyan": "\u001b[96m",
    "bright_white": "\u001b[97m",
    "reset": "\u001b[0m"
}

// pretty consolelog
const c = {
    "i": (s)=>{      // *i*nfo
        console.log(colors.green, " =>", colors.reset, s);
    }, "e": (s)=>{   // *e*rror
        console.error(colors.red, " !!", colors.reset, s);
    }, "w": (s)=>{   // *w*arn
        console.error(colors.yellow, " =!", colors.reset, s);
    }, "g": (p,s)=>{ // *g*et
        console.log(colors.cyan, "[>]", colors.magenta, p, colors.reset + s);
    }, "s": (p,s)=>{ // *s*end
        console.log(colors.cyan, "[<]", colors.magenta, p, colors.reset + s);
    }, "d": (s)=>{   // *d*ebug
        if (debugging)
            console.log(colors.blue, "</>", colors.reset, s);
    }
}

c.w("openbakalari jsou ve VELMI rane fazi vyvoje, ocekavej bugy");


// nevim tohle tady musi byt myslim je to tu od zacatku
xprs.use(express.urlencoded({ extended: true }));
xprs.use(express.json());

// logger
xprs.use((req, res, next) => {
    // prijmuti
    c.g(req.method, req.originalUrl);

    // nase odpoved
    res.on("finish", () => {
        c.s(res.statusCode, req.originalUrl);
    });

    // pokud debug zalogujeme vsecko
    if (debugging) {
        const dataPath = path.join(__dirname, '..',"debug", 'logs.txt');
        let data = "";
        try {
            if (fs.existsSync(dataPath)) {
                const fileData = fs.readFileSync(dataPath, 'utf8');
                data = fileData;
            }
        } catch (error) {
            console.error('Chyba při čtení databáze:', error);
        }
        data += "\n" + JSON.stringify({
            method: req.method,
            url: req.url,
            headers: req.headers,
            body: req.body,
            query: req.query,
            params: req.params
        }, null, 4);
        try {
            const dbDir = path.join(__dirname,'..','debug');
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }
            fs.writeFileSync(dataPath, data);
        } catch (error) {
            console.error('Chyba při ukládání do databáze:', error);
        }
    }
    next();
});

// moduly
fs.readdirSync("../moduly")
    .filter(subor => subor.endsWith(".js"))
    .forEach(subor => {
        const openbk_modul = {
            "original": subor
        };

        const uvnitr = fs.readFileSync(
            path.join("../moduly", subor),
            "utf8"
        );

        eval(uvnitr);
    });

// root apex
xprs.get("/", (req, res) => {
    res.send("200 ok");
});

// verze api a baseurl
xprs.use("/api/3", (req, res, next) => {
    if (req.path !== "/") return next();
    if (req.method !== "GET") {
        return res
            .status(405)
            .json({
                Message: `The requested resource does not support http method '${req.method}'.`
            });
    }

    res.json({
        ApiVersion: ver,
        ApplicationVersion: appver,
        BaseUrl: "api/3"
    });
});

//nevim tohle tady je od zacatku
// vim, to co je o par radku vyse ale
// jaky VSECHNY jsou dostupny (kompatibilita)
xprs.use("/api", (req, res, next) => {
    if (req.path !== "/") return next();
    if (req.method !== "GET") {
        return res
            .status(405)
            .json({
                Message: `The requested resource does not support http method '${req.method}'.`
            });
    }

    res.json([
        {
            ApiVersion: ver,
            ApplicationVersion: appver,
            BaseUrl: "api/3"
        }
    ]);
});

//console.log(mockDB);

xprs.use("/api/3/timetable/permanent", (req,res)=>{
        const token = req.headers.authorization.substring(7);
        const decoded = jwt.verify(token, jwtpublickey, { algorithms: ['RS256'] });
        const user = userdb.find(u => u.id === decoded.sub);
        const sub = decoded.sub;
        if (!user) {
            return res
                .status(401)
                .json({
                    "Message":"Authorization has been denied for this request.",
                    "bak:ApiVersion": ver,
                    "bak:AppVersion": appver
                });
        }
        const timetables = JSON.parse(fs.readFileSync("database/timetables-permanent.json", "utf-8"));
        const timetable = timetables.find(t => t.userid === decoded.sub).timetable;

        res.status(200);
        res.send(timetable);
});
xprs.use("/api/3/timetable/actual", (req,res)=>{
    const xd = JSON.parse(fs.readFileSync("timetable.json","utf-8"));
    res.json(xd);
});

// roboti uhh jak to rict slusne
// ok nejde to rict slusne
// roboti zasrany
xprs.get("/robots.txt", (req,res)=>{
    res.send(`
User-agent: *
Disallow: /
`);
});

// http
http.createServer(xprs).listen(PORT, (err) => {
    c.i(`HTTP naslouchá na ${PORT}`);
});
