/*jslint plusplus: false */
/*global define: false */
"use strict";

/**
 * An override for the jslib/parse.js to convert stealjs calls into
 * require/define calls.
 */

define(['../../jslib/parse'], function (baseParse) {

    var parse = baseParse,
        allowedCalls = {
            plugins: true,
            views: true
        },
        viewStringRegExp = /^\/\//;

    function hasStealCall(node) {
        if (!baseParse.isArray(node)) {
            return false;
        }

        if (node[0] === 'name' && node[1] === 'steal') {
            return true;
        } else if (node[0] === 'call' && node[1][0] === 'dot') {
            return hasStealCall(node[1][1]);
        }

        return false;
    }

    /**
     * Transform a .views depdencency to an ejs! plugin loaded depdendency
     * @param {String} value the .views string name.
     * @returns {String} an 'ejs!' string
     */
    function viewTransform(value) {
        return 'ejs!' + value.replace(viewStringRegExp, '');
    }

    function addStringsToArray(node, array, transform) {
        var i, item, matches = [];
        for (i = 0; i < node.length; i++) {
            item = node[i];
            if (item && baseParse.isArray(item) && item[0] === 'string') {
                matches.push((transform ? transform(item[1]) : item[1]));
            }
        }

        if (matches.length) {
            //Build up arguments to splice, since we need to put these
            //matches before other matches, given the backwards nature of
            //the call traversal in the AST.
            matches.unshift(0);
            matches.unshift(0);
            array.splice.apply(array, matches);
        }
    }

    function generateRequireCall(node, array) {
        if (!baseParse.isArray(node)) {
            return;
        }

        //Need to unwind the call since the dot access shows up "backwards"
        //in the AST.
        var args = node[node.length - 1],
            previous = node[node.length - 2],
            call = previous[previous.length - 1];

        if (typeof call === 'string' && allowedCalls[call]) {
            if (call === 'plugins') {
                addStringsToArray(args, array);
            } else if (call === 'views') {
                addStringsToArray(args, array, viewTransform);
            }

            //Find out if there are any other chained calls.
            previous = previous[previous.length - 2];

            generateRequireCall(previous, array);
        }
    }

    parse.oldParseNode = parse.parseNode;

    parse.parseNode = function (node) {
        var value;

        if (!this.isArray(node)) {
            return null;
        }

        //Allow files with regular define/require calls to be co-mingled
        //with StealJS APIs.
        value = this.oldParseNode(node);
        if (value) {
            return value;
        }

        if (hasStealCall(node)) {
debugger;
            value = [];
            generateRequireCall(node, value);
            return value.length ?
                   "require(" + JSON.stringify(value) + ");" : '';
        }

        return null;
    };

/*
 use console.log(JSON.stringify(node, null, '  ')) to print out AST

 Using this:
 steal.plugins('foo','bar').views('//abc/init.ejs').then(function(){})

 Has this for one of the nodes.

[
  "call",
  [
    "dot",
    [
      "call",
      [
        "dot",
        [
          "name",
          "steal"
        ],
        "plugins"
      ],
      [
        [
          "string",
          "foo"
        ],
        [
          "string",
          "bar"
        ]
      ]
    ],
    "views"
  ],
  [
    [
      "string",
      "//abc/init.ejs"
    ]
  ]
]

*/

    return parse;
});