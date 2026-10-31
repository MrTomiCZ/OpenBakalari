//import
const crypto = require("node:crypto");
const fsp = require('node:fs/promises');
const fs = require("node:fs");
const os = require("node:os");
const jwt = require("jsonwebtoken");

//globalni variably
/*let jwtpublickey;
let jwtprivatekey;
let userdb;*/
globalThis.jwtpublickey = "";
globalThis.jwtprivatekey = "";
globalThis.userdb = "";

//klice
async function generovat() {
    c.d("vytvarim klic");
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });

    c.d("davam do promenne");
    jwtpublickey = publicKey;
    jwtprivatekey = privateKey;

    /*
    const kid = crypto.createHash('sha256')
        .update(jwtpublickey)
        .digest('base64url')
        .slice(0, 22);*/

    c.d("existujou klice?");
    if (!fs.existsSync(path.join(__dirname, "..", "data", "klice"))) {
        c.d("ne");
        c.d("tvorim");
        await fsp.mkdir(path.join(__dirname, "..", "data", "klice"));
    } else c.d("ano");

    c.d("ukladam public");
    await fsp.writeFile(path.join(__dirname, "..", "data", "klice", 'jwt-public.pem'), jwtpublickey);
    c.d("ukladam privat");
    await fsp.writeFile(path.join(__dirname, "..", "data", "klice", 'jwt-private.pem'), jwtprivatekey, { mode: 0o600 });

/*    console.log({ kid, jwtpublickey });*/
}
async function nacistklic() {
    c.d("nacitam klice");
    c.d("ctu public");
    jwtpublickey = await fsp.readFile(path.join(__dirname, "..", "data", "klice", 'jwt-public.pem'), "utf-8");
    c.d("ctu private");
    jwtprivatekey = await fsp.readFile(path.join(__dirname, "..", "data", "klice", 'jwt-private.pem'), "utf-8");
}
async function nacistdatabazi() {
    c.d("Nacitam databazi");
    userdb = JSON.parse(await fsp.readFile(path.join(__dirname, "..", "data", "db", 'uzivatele.json'), "utf-8"));
}


//generace tokenu
function generateBakalariAccessToken(user, privateKey, expiresInSeconds, kid = "TBk6JNa0obFosMmfihQRHQ", issuer = os.hostname() || "https://mrtomicz.eu/") {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        "Bakalari.AccountType": "User",
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier": user.id,
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name": user.fullName || "Jan Novák",
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn": user.username || "jannovak",
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/gender": user.gender || "Male",
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/dateofbirth": user.dateOfBirth || "2010-09-29T00:00:00",
        "Bakalari.UserType": user.userType || "Z",
        "Bakalari.SessionId": crypto.randomBytes(16).toString("hex"),
        "Bakalari.TimeStamp": (BigInt(Date.now()) * 10000n + 621355968000000000n).toString(), // teckanet protoze ofiko bk je v .net
        "Bakalari.PersonIdWithType": user.id,
        "Bakalari.EvidNumber": user.evidNumber,
        "Bakalari.MachineName": os.hostname() || "OPENBK",
        "sub": user.id,
        "name": user.fullName || "Jan Novák",
        "oi_prst": "ANDR",
        "oi_au_id": crypto.randomBytes(16).toString("hex"),
        "client_id": "ANDR",
        "oi_tkn_id": crypto.randomBytes(16).toString("hex"),
        "aud": "bakalari_api",
        "scope": "offline_access bakalari_api timetable_widget",
        "jti": crypto.randomUUID(),
        "exp": now + expiresInSeconds,
        "iss": issuer,
        "iat": now
    };

    const options = {
        algorithm: 'RS256',
        header: {
            alg: "RS256",
            kid: kid,
            typ: "at+jwt"
        }
    };

    return jwt.sign(payload, privateKey, options);
}

xprs.use("/api/login", (req, res) => {
    if (req.method !== "POST") {
        return res
            .status(400)
            .json({
                Message: `The requested resource does not support http method '${req.method}'.`
            });
    }

    const params = new URLSearchParams(req.body);

    if (params.get("grant_type") == "password") {
        const username = params.get("username") || "";
        const password = params.get("password") || "";
        const user = userdb.find(u => u.username === username && u.password === password);
        if (!user) {
            return res
                .status(400)
                .json({
                    "error": "invalid_grant",
                    "error_description": "Nesprávné heslo",
                    "error_uri": "https://documentation.openiddict.com/errors/ID2024",
                    "bak:ApiVersion": ver,
                    "bak:AppVersion": appver
                });
        }
        res.json({
            "bak:ApiVersion": ver,
            "bak:AppVersion": appver,
            "bak:UserId": user.id,
            "access_token": generateBakalariAccessToken(user, jwtprivatekey, 3499),
            "token_type": "Bearer",
            "expires_in": 3499,
            "refresh_token": generateBakalariAccessToken(user, jwtprivatekey, 31556952)
        });
    }
    if (params.get("grant_type")=="refresh_token") {
        const refresh_token = params.get("refresh_token") || "";
        if (!refresh_token) {
            return res.status(400).json({ error: "invalid_request", error_description: "Missing refresh_token" });
        }
        let decoded;
        try {
            decoded = jwt.verify(refresh_token, jwtpublickey, { algorithms: ['RS256'] });
        } catch {
            return res
                .status(400)
                .json({
                    "error": "invalid_grant",
                    "error_description": "Neplatný Refresh token",
                    "error_uri": "https://documentation.openiddict.com/errors/ID2024",
                    "bak:ApiVersion": ver,
                    "bak:AppVersion": appver
                });
        }
        const user = userdb.find(u => u.id === decoded.sub);
        if (!user) {
            return res
                .status(400)
                .json({
                    "error": "invalid_grant",
                    "error_description": "Neplatný Refresh token",
                    "error_uri": "https://documentation.openiddict.com/errors/ID2024",
                    "bak:ApiVersion": ver,
                    "bak:AppVersion": appver
                });
        }
        res.json({
            "bak:ApiVersion": ver,
            "bak:AppVersion": appver,
            "bak:UserId": user.id,
            "access_token": generateBakalariAccessToken(user, jwtprivatekey, 3499),
            "token_type": "Bearer",
            "expires_in": 3499,
            "refresh_token": generateBakalariAccessToken(user, jwtprivatekey, 31556952)
        });
    }
});
xprs.use("/api/3/user", (req,res,next)=>{
    if (req.url !== "/") return next();
    // NEBUDEM ../src protoze to ..src/app.js exekutuje
    const dayta = JSON.parse(fs.readFileSync("user.json", "utf-8"));
    /* const dayta = {
        
    }; */ 
    // -- tohle je tezky generovat ted, kdyz jeste nejsou
    // poradne udelany moduly, takze se to bere z souboru
    // tohle pujde poradne udelat az s tema groupkama jak
    // jsem psal v todo.md
    res.send(dayta);
});



//generovat klic pokud neni

(async ()=>{
    if (!fs.existsSync(path.join(__dirname, "..", "data", "klice"))) {
        c.i("klíče neexistujou, generuju");
        await generovat();
    } else {
        await nacistklic();
    }
    await nacistdatabazi();
})();

setInterval(async()=>{
    c.d("setinterval bezi");
    await nacistdatabazi();
    //nacist znova uzivatel DB
}, 3000000);
