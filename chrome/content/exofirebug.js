FBL.ns(function () { with (FBL) {

var panelName = "ExoFirebug";

Firebug.ExoFirebugModule = extend(Firebug.Module,
	{
		initialize: function (prefDomain, prefNames) {
		Firebug.Module.initialize.apply(this, arguments);
	},

	loadedContext: function (context) {
		FBTrace.sysout("exofirebug; context loaded");
	},

	addStyleSheet: function (doc) {
		if ($("ebStyles", doc))
			return;

		var styleSheet = createStyleSheet(doc, "chrome://exofirebug/skin/exofirebug.css");
		styleSheet.setAttribute("id", "ebStyles");
		addStyleSheet(doc, styleSheet);
	},

	reattachContext: function (browser, context) {
		var panel = context.getPanel(panelName);
			this.addStyleSheet(panel.document);
	}
});

function ExoFirebugPanel() { }
ExoFirebugPanel.prototype = extend(Firebug.Panel,
{
	name: panelName,
	title: "ExoWeb",

	initialize: function (context, doc) {
		Firebug.Panel.initialize.apply(this, arguments);
		Firebug.ExoFirebugModule.addStyleSheet(this.document);
	},

	show: function () {
		Firebug.Panel.show.apply(this, arguments);

		var view = FBL.getContentView(this.context.window);
		if (typeof view.ExoWeb === "undefined") {
			WarningTemplate.showNoExoWeb(this.panelNode);
		} else {
			this.showToolbarButtons("fbExo_firebugButtons", true);
			ModelTemplate.showModel(this.panelNode, view.context);
		}		
	},

	hide: function () {
		Firebug.Panel.hide.apply(this, arguments);
		this.showToolbarButtons("fbExo_firebugButtons", false);
	}
});

function ExoPropertyPanel() { }
ExoPropertyPanel.prototype = extend(Firebug.Panel,
{
	name: "propertypanel",
	title: "Property Information",
	parentPanel: panelName,
	view: null,

	initialize: function (context, doc) {
		Firebug.Panel.initialize.apply(this, arguments);
		Firebug.ExoFirebugModule.addStyleSheet(this.document);

		this.view = FBL.getContentView(this.context.window);
		this.setSelection = bind(this.setSelection, this);
		this.mainPanel.panelNode.addEventListener("mouseup", this.setSelection, false);
	},

	show: function () {
		Firebug.Panel.show.apply(this, arguments);
	},

	getProperty: function (event) {
		var object = event.target.repObject;
		if (!object && event.target.wrappedJSObject)
			object = event.target.wrappedJSObject.repObject;

		if (object && (object instanceof this.view.ExoWeb.Model.Property))
			return object;
	},

	setSelection: function (event) {
		var property = this.getProperty(event);
		if (property) {
			PropertyInfoTemplate.showPropertyInfo(this.panelNode, property, this.view);
		}
	}
});

function ExoInstancePanel() { }
ExoInstancePanel.prototype = extend(Firebug.Panel,
{
	name: "instancepanel",
	title: "Instances",
	parentPanel: panelName,
	view: null,
	
	initialize: function(context, doc) {
		Firebug.Panel.initialize.apply(this, arguments);

		this.view = FBL.getContentView(this.context.window);
		this.setSelection = bind(this.setSelection, this);
		this.mainPanel.panelNode.addEventListener("mouseup", this.setSelection, false);
	},
	
	show: function() {
		Firebug.Panel.show.apply(this, arguments);
	},
	
	getType: function(event) {
		var object = event.target.repObject;
		if (!object && event.target.wrappedJSObject)
			object = event.target.wrappedJSObject.repObject;

		if (object && (object instanceof this.view.ExoWeb.Model.Type))
			return object;
	},
	
	setSelection: function (event) {
		var _type = this.getType(event);
		if (_type) {
			InstanceTemplate.showInstances(this.panelNode, _type, this.view);
		} else {
			WarningTemplate.showNoTypeSelected(this.panelNode);
		}
	}
});

var InstanceTemplate = domplate(Firebug.Rep,
{
	exoweb: null,
	
	tag:
		TABLE({ "class": "wideTable", cellpadding: 0, cellspacing: 0 },
			TBODY(
				FOR("instance", "$type|getInstances",
					TR({ "class": "toggleRow hoverRow", onclick: "$onClickRow", _repObject: "$instance" },
						TD({ "class": "label indent" }, "$instance.name")
					)
				)
			)
		),

	propertyValues:
		TABLE({ "class": "wideTable", cellpadding: 0, cellspacing: 0 },
			TBODY(
				FOR("property", "$instance|getProperties",
					TR({ "class": "propertyRow" },
						TD({ "class": "label" }, "$property.name"),
						TD({ "class": "literal" }, "$property.value")
					)
				)
			)
		),

	getProperties: function(instance) {
		var propertyList = instance.meta.type.get_properties();
		var properties = [];

		for (var property in propertyList) {
			var p = propertyList[property];
			if (p instanceof this.exoweb.Model.Property) {
				properties.push({
					name: p.get_name(),
					value: instance[p._fieldName]
				});
			}
		}

		return properties;
	},

	getInstances: function(type) {
		var instances = [];

		for (var instance in type._pool) {
			instances.push({
				name: type._pool[instance].meta.id,
				value: type._pool[instance]
			});
		}
		
		return instances;
	},

	onClickRow: function (event) {
		if (isLeftClick(event)) {
			var row = getAncestorByClass(event.target, "toggleRow");
			if (row) {
				this.toggleRow(row);
				cancelEvent(event);
			}
		}
	},

	toggleRow: function (row) {
		toggleClass(row, "opened");

		if (hasClass(row, "opened")) {
			var instance = row.repObject;
			if (!instance && row.wrappedJSObject)
				instance = row.wrappedJSObject.repObject;

			this.propertyValues.insertRows({ instance: instance.value }, row);
		} else {
			row.parentNode.removeChild(row.nextSibling);
		}
	},
	
	showInstances: function(parentNode, type, context) {
		this.exoweb = context.ExoWeb;	
		this.tag.replace({ type: type }, parentNode, this);
	}
});

var WarningTemplate = domplate(Firebug.Rep,
{
	tag:
		DIV({ "class": "disabledPanelBox" },
			H1({ "class": "disabledPanelHead" },
				SPAN("$pageTitle")
			),
			P({ "class": "disabledPanelDescription", style: "margin-top: 15px;" },
			SPAN("$suggestion")
		)
	),

	showNoExoWeb: function (parentNode) {
		var args = {
			pageTitle: "ExoWeb not loaded",
			suggestion: "Try reloading the page, or navigating to a page which uses ExoWeb"
		};

		return this.tag.replace(args, parentNode, this);
	},
	
	showNoTypeSelected: function(parentNode) {
		var args = {
			pageTitle: "No Type Selected",
			suggestion: "Please select a type on the left"
		};
		
		return this.tag.replace(args, parentNode, this);
	}
});

var ModelTemplate = domplate(Firebug.Rep,
{
	tag:
		TABLE({ "class": "wideTable", cellpadding: 0, cellspacing: 0 },
			TBODY(
				FOR("type", "$metadata|getTypes",
					TR({ "class": "toggleRow hoverRow", onclick: "$onClickRow", _repObject: "$type" },
						TD({ "class": "label" },
							DIV(
								SPAN({ "class": "$type|isClientOnly", _repObject: "$type" }, "$type._fullName")
							)
						)
					)
				)
			)
		),


	typeBody:
		TR({ },
			TD({ colspan: 2 },
				TABLE({ "class": "wideTable indent", cellpadding: 0, cellspacing: 0 },
					TBODY(
						FOR("property", "$type._properties|getProperties",
							TAG("$propertyRow", { property: "$property" })
						)
					)
				)
			)
		),

	propertyRow:
		TR({ "class": "hoverRow", _repObject: "$property" },
			TD({ },
				DIV({ },
					SPAN({ "class": "propertyLink $property|isClientOnly", _repObject: "$property" }, "$property._name")
				)
			)
		),

	getTypes: function (data) {
		var types = [];

		for (var type in data) {
			types.push(data[type]);
		}

		return types.sort(function (a, b) { return a._fullName > b._fullName; });
	},

	getProperties: function (data) {
		var properties = [];

		for (var property in data) {
			properties.push(data[property])
		}

		return properties.sort(function (a, b) { return a._name > b._name; });
	},

	isClientOnly: function (type) {
		return type._origin !== "server" ? "isClientOnly" : "";
	},

	onClickRow: function (event) {
		if (isLeftClick(event)) {
			var row = getAncestorByClass(event.target, "toggleRow");
			if (row) {
				this.toggleRow(row);
				cancelEvent(event);
			}
		}
	},

	toggleRow: function (row) {
		toggleClass(row, "opened");

		if (hasClass(row, "opened")) {
			var type = row.repObject;
			if (!type && row.wrappedJSObject)
				type = row.wrappedJSObject.repObject;

			this.typeBody.insertRows({ type: type }, row);
		} else {
			row.parentNode.removeChild(row.nextSibling);
		}
	},

	showModel: function (parentNode, context) {
		FBTrace.sysout("exofirebug; showModel (" + Object.keys(context.model.meta._types).length + " types found)");

		var args = {
			metadata: context.model.meta._types
		};

		this.tag.replace(args, parentNode, this);
	}
});

var PropertyInfoTemplate = domplate(Firebug.Rep,
{
	exoweb: null,
	
	tag:
		TABLE({ "class": "widetable", cellpadding: 0, cellspacing: 0, width: "100%" },
			TBODY(
				TR({ "class": "propertyHeaderRow" },
					TD({ "class": "propertyHeader", colspan: 2 }, "Details")
				),
				TR({ "class": "propertyRow" },
					TD({ "class": "label" }, "Field Name:"),
					TD({ }, "$metadata._fieldName")
				),
				TR({ "class": "propertyRow" },
					TD({ "class": "label" }, "Label:"),
					TD({ }, "$metadata._label")
				),
				TR({ "class": "propertyRow" },
					TD({ "class": "label" }, "Is List:"),
					TD({ }, "$metadata._isList")
				),
				TR({ "class": "propertyRow" },
					TD({ "class": "label" }, "Is Static:"),
					TD({ }, "$metadata._isStatic")
				),
				TR({ "class": "propertyRow" },
					TD({ "class": "label" }, "Origin:"),
					TD({ }, "$metadata._origin")
				),
				TR({ "class": "propertyHeaderRow" },
					TD({ "class": "propertyHeader", colspan: 2 }, "Rules")
				),
				FOR("rule", "$metadata|getRules",
					TR({ "class": "propertyRow" },
						TD({ "class": "indent", colspan: 2 }, "$rule")
					)
				)
			)
		),
	
	getRules: function (metadata) {
		var result = [];
		var rules = metadata.rules();

		for (var i = 0; i < rules.length; i++)
			result.push(this.getRuleName(rules[i]));

		return result.sort();
	},

	getRuleName: function (forRule) {
		for (var ruleName in this.exoweb.Model.Rule) {
			if (this.exoweb.Model.Rule.hasOwnProperty(ruleName)) {
				var ruleType = this.exoweb.Model.Rule[ruleName];
				if (typeof ruleType === "function") {
					if (forRule instanceof ruleType)
						return ruleName;
				}
			}
		}
		
		return "";
	},
	
	showPropertyInfo: function(parentNode, property, context) {
		this.exoweb = context.ExoWeb;	
		this.tag.replace({metadata: property}, parentNode, this);
	}
});

Firebug.registerModule(Firebug.ExoFirebugModule);
Firebug.registerPanel(ExoFirebugPanel);
Firebug.registerPanel(ExoInstancePanel);
Firebug.registerPanel(ExoPropertyPanel);

}
});