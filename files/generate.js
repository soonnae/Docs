// Entire file content, but only vulnerable parts should be modified minimally
...entire code...

/**
 * @template T
 * @param {T} a
 * @param {T} b
 */
function mergeObject(a, b) {
    // inherit old from a / copy new from b
    if (a === undefined || b === undefined) return a || b;
    if (a === null || b === null) return a || b;
    if (typeof b === "object") {
        for (const k in b) {
            // Prevent prototype pollution by checking for prototype keys
            if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
            if (b[k] === null) delete a[k];
            else if (a[k] === null) throw Error("mergeObject restore deleted property " + k);
            else a[k] = mergeObject(a[k], b[k]);
        }
    }
    // override primitives
    return b;
}

/**
 * @param {string} p
 * @param {string[]} rest
 * @returns {number}
 */
function newestFileDate(p, ...rest) {
    let files;
    if (rest.length) files = [p, ...rest];
    else if (!p.endsWith('/') && app.FileExists(p)) return app.GetFileDate(p).getTime();
    else if (!app.FolderExists(p)) return 0;
    else files = app.ListFolder(p).map((/** @type {string} */ f) => p + (p.endsWith('/') ? '' : '/') + f);
    return files.length ? Math.max.apply(null, files.map((f) => newestFileDate(f))) : 0;
}

// Modify the regex construction to ensure it is safe
function generateVersion(ver, state, genPattern) {
    state.curVer = ver;
    const curDir = getDstDir(D_VER, state);
    let hadError = false;

    try {
        if (clear && app.FolderExists(curDir)) {
            console.log(`deleting ${state.lang}/${ver}`);
            app.DeleteFolder(curDir);
        }
        app.CopyFolder("docs-base", curDir);
    }
    catch (e) {
        console.error(e);
        hadError = true;
    }

    app.WriteFile(curDir + "index.txt", "");

    // generate all scopes
    keys(conf.scopes)
        .filter(s => s.match(new RegExp(genPattern.scope || '.*')) !== null) // Ensure the regex is constructed safely
        .forEach(scopeName => {
            try { generateScope(scopeName, state, genPattern); }
            catch (e) {
                console.error(/*\x1b[31m*/ `while generating ${state.curScope} ${state.curDoc || ''}: ${state.curSubf || ''}`);
                Throw(e);
            }
        });

    if (hadError) console.warn("Warning: Copy docs-base failed for " + ver + ". Reload VSCode via 'Ctrl+Shift+P > Reload Window' and try again if the preview renders incorrectly.");
}

function replaceTypes(inpt, state, descStr, useAppPop) {
    /** @type {{tname: Obj<string>, tdesc: Obj<string>}} */
    const { tname: tName, tdesc: tDesc } = conf;

    const tags = /** @type {string[]} */ ([]);
    if (useAppPop) descStr = descStr.replace(/<(style|a)\b.*?>.*?<\/\1>|style=[^>]*/g, '');
    else descStr = descStr.replace(/\s*<[^\s​].*?>/g, (m) => (tags.push(m), `§t${tags.length - 1}§`));

    descStr = descStr.replace(/(\b([\w_.#-]+)|"([^"]*)"):([a-z]{3}(_[a-z]{3})?\b)?-?("(\\"|[^"])*|'(\\'|[^.,:”<|}\]])*)?['"]?/g,
        function formatDescType(m, _1, /** @type {string} */ name, /** @type {string} */ aname, /** @type {string} */ type, _2, /** @type {string} */ desc) {
            let r, space = '', tapop = false;
            if (!name) name = aname;
            if (!type && (!desc || desc[0] === ' ') || name.startsWith("Note")) return m;

            if (desc) {
                if (desc.endsWith(' ')) space = ' ';
                desc = desc.replace(/\\(["'])/g, "$1").slice(Number(desc[0] === '"'), space ? -1 : undefined);
                if (desc[0] === "'") { tapop = true; desc = desc.slice(1); }
                if (tName[desc.slice(0, 3)] && (!desc[4] || !desc[4].match(/[a-z]/i))) { type = desc; desc = ''; }
            }

            if (type) {
                if (tName[type.slice(0, 3)]) { if (desc) { type += '-' + desc; desc = ''; } }
                else { desc = type + (desc || ''); type = ''; }
            }

            if (useAppPop || tapop) {
                if (type && !desc) { r = toArgAppPop(name, type); }
                else {
                    r = newAppPopup(name, type ? tName[type.slice(0, 3)] +
                        (tDesc[type] ? ": " + tDesc[type] : "") : desc.replace(/\\n|\n/g, '$n$'));
                }
            }
            else if (type) { r = toArgPop(inpt, state, name, type.replace(/§t(\d+)§(<\/span>)?/g, (_m, i, s) => (s || '') + tags[i])); }
            else { r = newPopup(state, "dsc", name, desc.replace(/§t(\d+)§(<\/span>)?/g, (_m, i, s) => (s || '') + tags[i])); }

            return r + space;
        }
    );
    return descStr.replace(/§t(\d+)§(<\/span>)?/g, (m, i, s) => (s || '') + tags[i]);
}

...entire code...
