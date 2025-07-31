// Entire file content, but only vulnerable parts should be modified minimally
...entire code...

$(document).live('pageshow', function (event, ui) {
	//try
	{
		//Remove IOIO links if not relevent.
		//if( document.getElementById("ioio") ) {
		//	if( app.GetName()!="IOIOScript") ioio.innerHTML = "";
		//}
		//Remove NXT links if not relevent.
		//if( document.getElementById("nxt") ) {
		//	if( app.GetName()!="NxtScript") nxt.innerHTML = "";
		//}

		//Set appropriate body style.
		if (!isAndroid || useWebIDE) document.body.className = "bodyPC";

		//Remove 'Copy' and 'Run' buttons on PC.
		// if(!isDS && !isAndroid) hidecopy();
		if (!isDS) $("div[name=divCopy] > a:contains(Run)").hide();

		// hide theme switch button inside DS
		if (isDS) $(".ui-header .ui-btn[data-icon=gear]").hide();

		//If on Android, save current page.
		if (isMobileIDE)
			setTimeout("app.SetData( 'CurWebDoc', document.title )", 1); //<-- to stop HTC crash.

		// set language mode
		setMode(Array.isArray(curMode) && curMode[1] || getCookie("dsDocsMode", "js"));

		//Get current page id.
		curPage = $.mobile.activePage.attr('id');

		// change link to ui/UI.html inside DS
		if (curPage == "main") {
			if (isMobileIDE && !app.FileExists(baseFolder + "UIDocs.htm"))
				$("a:contains(Hybrid UI)").attr("href", "ui/UI.html");
			else if (isWebIDE) {
				getIdeList("list&dir=.edit/docs/", function _onIdeList(data) {
					if (!data.list.includes("UIDocs.htm"))
						$("a:contains(Hybrid UI)").attr("href", "ui/UI.html");
				})
			}
		}

		//Show plugins list if 'plugins' page is loading.
		if (curPage == "plugins") ShowPluginsPage()
		else if (curPage == "extensions") ShowExtensionsPage()

		//Append popup div in plugin docs if not exists
		if (!$(".androidPopup").parent().is(":visible"))
			$(".ui-content").append($(".androidPopup:first").parent().clone());

		initSequentialPopups();
		highlightSearch();

		$('.onlyinclude a:not(data-ajax)').attr("data-ajax", "false");
		$("a#extLink").attr("onclick", "return OpenUrl(this.href);");

		//Ask parent for DS adddress
		if (!isMobileIDE) {
			parent.postMessage("getaddress:", "*")
			setTimeout(function () { parent.postMessage("getaddress:", "*") }, 3000) //<-- needed for first time load.
		}
	}
	//catch( e ) {}
});

function initSequentialPopups() {
	var nextPop = null, updated = false;
	// store next popup
	$("a[data-rel=popup]").on("click", function () { nextPop = this; updated = 2; });
	// close popup on window clicks
	$(window).off("click").on("click", function () { updated--; $("div.ui-popup-active > div").popup("close"); });
	$("div[data-role=popup]")
		// prevent default popup behaviour
		.on("click", function (e) { e.stopPropagation(); e.preventDefault(); })
		// trigger next popup after close
		.on("popupafterclose", function () { if (updated > 0 && nextPop) nextPop.click(); });
}

function highlightSearch() {
	var search = location.href.match(/(\bsearch=)([^&#]+)/i);
	var flags = location.href.match(/(\bflags=)(\d+)/i) || 0;

	if (search) {
		search = decodeURIComponent(search[2]);
		flags = flags && Number(flags[2]);
		console.log("search", search, flags)
		/** @type {import("mark.js").MarkOptions} */
		var options = {
			acrossElements: true, caseSensitive: flags & 1, ignoreJoiners: true,
			ignorePunctuation: ":;.,-–—‒_(){}[]!'\"+=".split("")
		};
		if (flags & 2) $(".ui-content").markRegExp(RegExp(search, flags & 1 ? "sui" : "su"), options);
		else $(".ui-content").mark(search, options);
		jumpToElement($('mark:first'));
	}
}

//Handle address message (Wifi ide)
function OnAddress() {
	console.log("address: " + serverAddress)

	//Timeout required to allow time for page to fully rendeder.
	//setTimeout( function()
	//{
	if (curPage == "main") {
		var link = document.querySelector("#docsLink")
		if (link) link.setAttribute("href", encodeURI(serverAddress + "/.edit/docs/Plugins.htm"))

		link = document.querySelector("#extsLink")
		if (link) link.setAttribute("href", encodeURI(serverAddress + "/.edit/docs/Extensions.htm"))
	}
	//}, 3000 )
}


function makeLink(name, path, ext) {
	var btnRem = '<a href="#" data-icon="delete" data-iconpos="notext" onclick="Remove' + (ext ? 'Extension' : 'Plugin') + '(\'$1\')"></a>';
	var link = '<a href="$1">$2</a>';
	return "<li>" + link.replace("$2", name).replace("$1", ext ? "#" : encodeURI(path)) +
		btnRem.replace("$1", name) + "</li>\n"
}

function addList(parent, list, getPath) {
	var html = '<ul data-role="listview" data-inset="true" data-filter="false">\n';

	for (var i in list)
		if (list[i])
			html += makeLink(list[i], getPath(list[i]), parent == '#divExts');

	html += "</ul>";
	$(parent).html(html);
	$(parent).trigger("create");
}

function jumpTo(contains) {
	//Control popup
	var popup = $("div.samp > a.ui-link:contains(" + contains + ")");
	if (popup.length) {
		jumpToElement(popup, 100).delay(350).queue(_ => popup.click());
		return false;
	}

	//Header
	var header = $(":header:contains(" + contains + ")");
	if (header.length) {
		jumpToElement(header);

		header.clearQueue().delay(100)
			.animate({ opacity: 0.1 }, 400)
			.animate({ opacity: 1.0 }, 400);

		return false;
	}
}

function jumpToElement(el, offset = 50) {
	el = $(el);
	if (has(el[0].className, "ui-collapsible-heading-collapsed"))
		el.click();

	return $("html").clearQueue()
		.animate({ scrollTop: el.offset().top - offset }, 300);
}

...rest of the code...
