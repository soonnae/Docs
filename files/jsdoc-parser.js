const fs = require("fs-extra");
const path = require("path");
const conf = require("./conf.json");
const getComment = require("esprima-extract-comments");
const rimraf = require("rimraf");

/** @type {0 | 1 | 2 | 3} off | error | warn | more */
let verbose = 1;
const extraFormat = false;
const LANG = "en";
const SRC = path.normalize(__dirname + "/markup/" + LANG);
const DST = path.normalize(__dirname + "/json/" + LANG + "/" + conf.version);

const typx = "all,bin,dso,gvo,jso,swo,fnc,lst,num,obj,str,?,uio";
/** @type {Obj<string>} */
const types = {
    String: "str",
    Number: "num",
    Object: "obj",
    Boolean: "bin",
    Function: "fnc",
    Array: "lst",
    Any: "all",
    AppObject: "dso",
    GameObject: "gvo",
    JSObject: "jso",
    SmartWatchObject: "swo",
    unknown: "?",
    UIObject: "uio"
};

let _errors = 0;

/**
 * @param {string} SOURCE_DIR
 * @param {string} fn Filename
 */
function LoopFiles(SOURCE_DIR, fn) {
    // console.log("<---- Generating json for "+SOURCE_DIR+" ----->";
    if (!fs.existsSync(SOURCE_DIR)) return console.log(SOURCE_DIR + " does not exist!");

    const folder = path.basename(SOURCE_DIR);
    const outputFolder = path.join(DST, folder);
    const outputSamples = path.join(outputFolder, "samples");
    const outputDesc = path.join(outputFolder, "desc");

    // parent methods
    // let parent = false
    if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder, { recursive: true });
    if (!fs.existsSync(outputSamples)) fs.mkdirSync(outputSamples, { recursive: true });
    if (!fs.existsSync(outputDesc)) fs.mkdirSync(outputDesc, { recursive: true });

    const baseFile = SOURCE_DIR + "_base.js";
    /** @type {Obj<DSFunction|string>} */
    let baseJson = {};
    if (fs.existsSync(baseFile)) baseJson = getBaseMethods(baseFile);

    /** @type {Obj<DSFunction>} */
    let objJson = {};

    let files = fs.readdirSync(SOURCE_DIR);
    // TODO: Support regex for this "file filtering" method in the future
    if (fn) {
        files = files.filter(m => m.includes(fn));
        if (!files.length) return console.log("Empty files for '" + fn + "' filter");
        const objPath = path.join(__dirname, "json", LANG, conf.version, folder, "obj.json");
        if (fs.existsSync(objPath))
            objJson = JSON.parse(fs.readFileSync(objPath, 'utf8'));
    }
    files.sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));

    /** @type {Obj<string[]>} */
    let navs = {};
    const navsPath = path.join(SOURCE_DIR, "..", folder + "-navs.json");
    if (fs.existsSync(navsPath))
        navs = JSON.parse(fs.readFileSync(navsPath, 'utf8'));

    for (const file of files) {
        const folderPath = path.join(SOURCE_DIR, file);
        const stats = fs.statSync(folderPath);
        if (!stats.isFile()) continue;//console.log( "Sub-folder is not rendered" )
        if (file.endsWith(".js")) {
            const data = renderFile(folderPath, objJson, baseJson, navs);

            // write description.md file
            const descFile = path.join(outputDesc, data.name + ".md");
            if (data.desc && !_errors) fs.writeFileSync(descFile, data.desc.replace(/<br>/g, '\n'));

            // write sample.txt file
            const sampleFile = path.join(outputSamples, data.name + ".txt");
            if (!_errors && data.samples.js) fs.writeFileSync(sampleFile, data.samples.js);
            const pysampleFile = path.join(outputSamples, data.name + "-py.txt");
            if (!_errors && data.samples.py) fs.writeFileSync(pysampleFile, data.samples.py);
        }
        else if (file.endsWith(".md")) {
            const data = renderMdFile(folderPath, objJson);
            // write description.md file
            const descFile = path.join(outputDesc, data.name + ".md");
            if (!_errors) fs.writeFileSync(descFile, data.desc.replace(/<br>/g, '\n'));
        }
    }
    Throw(null, SOURCE_DIR);

    /** @type {Obj<DSFunction>} */
    const rObjJson = JSON.parse(JSON.stringify(objJson));
    /** @param {DSFunction} o */
    const descOnly = o => String(Object.keys(o)) === 'desc' && (!o.desc || /^#.*\.md$/.test(o.desc));
    if (Object.values(rObjJson).every(o => descOnly(o))) return void 0;

    if (Object.keys(objJson).length) {
        const objJsonFile = path.join(outputFolder, "obj.json");
        fs.writeFileSync(objJsonFile, tos(objJson));
    }

    if (Object.keys(baseJson).length) {
        const baseJsonFile = path.join(outputFolder, "base.json");
        fs.writeFileSync(baseJsonFile, tos(baseJson).replace(/\s+"name": /g, ' "name": '));
    }

    if (Object.keys(navs).length) {
        const navsJsonFile = path.join(outputFolder, "navs.json");
        fs.writeFileSync(navsJsonFile, JSON.stringify(navs, null, '\t'));
    }

    const scopePath = path.join(SOURCE_DIR, "..", folder + ".js");
    if (fs.existsSync(scopePath)) {
        const scopeJSFile = path.join(outputFolder, folder + ".js");
        fs.copyFileSync(scopePath, scopeJSFile);
    }
}

// converts a variable to indented string
// supports Boolean, Number, String, Array and Object
/**
 * @param {any} o
 * @param {string} [intd]
 * @returns {string}
 */
function tos(o, intd = "") {
    if (o === null || o === undefined) return "null";
    if (Array.isArray(o)) return "[" + o.map(e => tos(e, intd)).join(', ') + "]";
    if (typeof o == "object") {
        var okeys = Object.keys(o).filter(k => o[k] !== undefined);
        if (!okeys.length) return "{}";
        return "{\n" + okeys.map(k => intd + `\t"${k}": ${tos(o[k], intd + "\t")}`).join(",\n") + `\n${intd}}`;
    }
    return JSON.stringify(o);
}

/**
 * @param {string} filePath
 * @param {Obj<DSFunction>} objJson
 * @param {Obj<DSFunction|string>} baseJson
 * @param {Obj<string[]>} navs
 */
function renderFile(filePath, objJson, baseJson, navs) {

    const file = path.basename(filePath);

    const strComments = getComment.file(filePath, {});

    const _fname = file.slice(0, -3);

    const objData = RenderComments(objJson, strComments, true, _fname, baseJson);
    /** @type {typeof objData} */
    const data = JSON.parse(JSON.stringify(objData));

    for (const cat of objData.categories) {
        if (!navs[cat]) navs[cat] = [];
        if (!navs[cat].includes(objData.name)) navs[cat].push(objData.name);
    }

    // description
    let desc = objJson[data.name].desc || '';
    objJson[data.name].desc = "#" + data.name + ".md";

    let popups = "";
    const props = data.props;
    props.sort((a, b) => (a[1] < b[1] ? -1 : 1));

    if (props.length) {
        desc += "<h3>Properties</h3>";
        desc += "These are the setter and getter properties for the " + data.name + " Component.\n";
        for (let o = 0; o < props.length; o++) {
            const p = props[o];
            p[2] = extractBacktickStrings(p[2]);
            const id = p[1].toLowerCase().trim() + "-" + (o * 5);
            desc += `<div class="samp"><a href="#${id}" data-transition="pop" data-rel="popup" class="ui-link">${p[1]}</a></div>`;
            popups += `<div data-role="popup" id="${id}" class="ui-content"><p><span style="color:#4c4;">${p[0]}</span><br>${p[2]}</p></div>`;
        }
        desc += "\n" + popups;
    }

    desc = extractBacktickStringsDesc(desc.trim());
    if (desc.length < 256) {
        objJson[data.name].desc = desc;
        desc = "";
    }
    else { desc += "\n"; }

    return {
        name: data.name,
        desc,
        samples: data.samples
    };
}

/** @returns {DSFunction} */
const newDSFunc = () => ({
    name: undefined,
    abbrev: undefined,
    desc: "",
    isval: undefined,
    pNames: undefined,
    pTypes: undefined,
    params: undefined,
    retval: undefined,
    shortDesc: undefined,
});

/**
 * Render markown files.
 * @param {String} filePath Path to the md file
 * @param {Obj<DSFunction>} objJson
 */
function renderMdFile(filePath, objJson) {
    const file = path.basename(filePath);
    const name = file.slice(0, -3);
    const desc = fs.readFileSync(filePath, "utf8");
    objJson[name] = newDSFunc();
    objJson[name].desc = "#" + name + ".md";
    return {
        name,
        desc
    };
}

/**
 * Get base methods.
 * @param {String} filePath Path to the _base.js file
 */
function getBaseMethods(filePath) {
    const file = path.basename(filePath);
    const strComments = getComment.file(filePath, {});
    const name = file.slice(0, -3);
    const objData = RenderComments({}, strComments, true, name, {});
    Throw(null, filePath);
    return objData.json;
}

/** @param {string | null} e */
function Throw(e, filePath = '') {
    if (e) {
        _errors++;
        if (verbose) console.error(`\x1b[31m${e}\x1b[37m`);
    } else if (_errors) {
        const msg = `Errors detected${filePath && ' in ' + filePath}. Fix all of them to continue.`;
        throw Object.assign(Error(msg), { stack: '' });
    }
}

/** @type {(msg:string, lvl?:typeof verbose) => void} */
function Warn(msg, lvl = 2) {
    if (verbose >= lvl) console.warn(`\x1b[30mWarning: ${msg}\x1b[37m`);
}


/** @ts-ignore @type {<T>(O: T) => (Extract<keyof T, string>)[]} */
function keys(o) { return Object.keys(o || []); }

/**
 * @param {Obj<DSFunction | string>} objJson
 * @param {import('esprima').Token[]} tokens
 * @param {boolean} cmp
 * @param {string} name
 * @param {Obj<DSFunction|string>} baseJson
 */
function RenderComments(objJson, tokens, cmp, name, baseJson) {
    /** @type {DSFunction} */
    let func = {};
    objJson[name] = func;

    const samples = { js: "", py: "" };
    /** @type {string[][]} */
    const props = [];
    /** @type {string[]} */
    const categories = [];
    /** @type {Obj<DSFunction|string>} */
    const json = {};

    tokens.forEach(c => {
        if (c.type === "BlockComment") {
            const mt = c.value.match(/@\s*(ex|s)ample *-? *(.*)/i);
            if (mt) {
                const t = mt[2].trim() || '';
                const ext = t.startsWith("Python") ? "py" : "js";
                const title = t.slice(ext === "py" ? 7 : 0).trim();

                const cod = c.value.substring(c.value.indexOf('\n', mt.index)).trim();
                const sample = `\n\n<sample${title && ' ' + title}>\n${cod.replace(/\*_/g, '*/')}\n</sample>`;
                samples[ext] += sample;
            }
            else if (c.value.includes('
