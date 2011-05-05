/* 
 * javascript format
 * ------------------
 * writen by hongru.chen [hongru.chenhr[at]gmail.com]
 * 
 * Options:
 * {
 *      indentSize: (default 4),                --> indentation size
 *      indentChar: (default space),            --> character to indentation with
 *      isBlankLinesRetain: (default true),     --> whether to preserve blank new lines
 *      maxBlankLines: (default unlimited),     --> max blank lines to preserve
 *      isSpaceAfterAnonFunc: (default true),   --> 'function()' or 'function ()'
 *      braceStyle: (default 'collapse'),       --> 'collapse' || 'expand' || 'end-expand'
 *      isKeepArrayIndent: (default false)      --> [[], []] or [
                                                                    [],
                                                                    []
                                                                ]
 * }
 * 
 * e.g
 * new jsFormat(sourceText, options)
 *
 */ 
 
(function () {

    var extend = function (target, source, overwrite) {
        if (overwrite === undefined) overwrite = true;
        for (var p in source) {
            if (overwrite || !(p in target)) 
                target[p] = source[p];
        }
        return target;
    },
    log = function (s) {
        !!window.console && window.console.log(s);
    };
    
    var jsFormat = function (source, options) {
        this.setOptions(options);
        this.setVars(source);
        //this.setMode();
        this.initialize();
    };
    extend(jsFormat.prototype, {
        setOptions: function (o) {
            this.opt = {
                indentSize            : 4,
                indentChar            : ' ',
                isBlankLinesRetain    : true,
                maxBlankLines        : false,
                isSpaceAfterAnonFunc: true,
                isKeepArrayIndent    : false,
                braceStyle            : 'collapse',
                isParseHtml            : false
            };
            extend(this.opt, o || {});
        },
        setVars: function (s) {
            this.indentStr         = '';
            this.source         = s;
            this.lastWord         = '';
            this.lastType         = 'TK_START_EXPR'; // the default value of lastType
            this.lastText         = '';
            this.preLastText     = '';
            this.output         = [];
            this.whitespace     = ' \n\r\t'.split('');
            this.wordchar        = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_$'.split('');
            this.numbers         = '0123456789'.split('');
            this.operator        = '+ - * % & ++ -- = += -= *= /= %= == === != !== > < >= <= >> << >>> >>>= >>= <<= && &= | || ! !! , : ? ^ ^= |= ::'.split(' ');
            this.lineKeywords    = 'continue,try,catch,finaly,throw,return,var,if,else,switch,case,default,for,while,do,break,function,this,new'.split(',');
            this.jsKeywords        = 'getElementById,getElementsByTagName,getElementsByName,length,offsetLeft,offsetRight,offsetWidth,offsetHeight,scrollLeft,scrollTop,setInterval,clearInterval,setTimeout,clearTimeout,clientWidth,clientHeight,document,window,Date,Number,String,Object,Array,Boolean,Function,null,true,false'.split(',');
            this.tokenStore     = [];
            this.parsePos        = 0;
            this.sourceLength    = s.length;
            this.token            = {};
            this.initIndentLv    = 0;
            this.toHtml         = ''; 
        },
        encodeHtml: function (str) {
            if (this.opt.isParseHtml) {
                var el = document.createElement('pre'),
                    t = document.createTextNode(str);
                el.appendChild(t);
                return el.innerHTML;
            }
            return str;
        },
        isInArray: function (c, arr) {
            for (var i = 0; i < arr.length; i ++) {
                if (c === arr[i]) return true;
            }
            return false;
        }, 
        isArrayMode: function (mode) {
            return (mode === '[EXPRESSION]' || mode === '[INDENTED_EXPRESSION]');
        },
        // trim whitespace at the end of output
        // if isEatLines == true, also trim the newline space such as '\n' '\r'
        trimOutput: function (isEatLines) {
            var o = this.output,
                l = o.length;
            while(!!l && (o[l-1] === ' ' || o[l-1] === this.indentStr || (!!isEatLines && (o[l-1] === '\n' || o[l-1] === '\r')))) {
                this.output.pop();
            }
        },
        getToken: function () {
            if (this.parsePos > this.sourceLength) {
                return ['', 'TK_EOF'];
            }
                        
            var c = this.source.charAt(this.parsePos); 
            this.parsePos ++;

            this.blanklinesN = 0;
            // word
            if (this.isInArray(c, this.wordchar)) {
                return this._wordToken(c);
            }
            // expression '(' or '['
            if (c === '(' || c === '[') {
                return [c, 'TK_START_EXPR'];
            }
            // expression ')' or ']'
            if (c === ')' || c === ']') {
                return [c, 'TK_END_EXPR'];
            }
            // brace '{'
            if (c === '{') {
                return [c, 'TK_START_BRACE'];
            }
            // brace '}'
            if (c === '}') {
                return [c, 'TK_END_BRACE'];
            }
            // semicolon ';'
            if (c === ';') {
                return [c, 'TK_SEMICOLON'];
            }
                    
            /* !! modify at 2010 04 12 */
            if (c === '/') {
                if (this.source.charAt(this.parsePos) === '/' || this.source.charAt(this.parsePos) === '*') {
                    return this._commentToken(c);
                }
                else if (this.lastType === 'TK_REGEXP' 
                        || this.lastType === 'TK_STRING'
                        //|| this.lastType === 'TK_END_BRACE'
                        || this.lastType === 'TK_END_EXPR' 
                        || (this.lastType === 'TK_BLOCK_COMMENT' && this.preLastType === 'TK_WORD' && this.preLastText !== 'return' && this.preLastText !== 'do')
                        || (this.lastType === 'TK_WORD' && this.lastText !== 'return' && this.lastText !== 'do')) {
                    return [c, 'TK_OPERATOR']
                }
                else {
                    return this._regexpToken(c);
                }
            }
            
            // operator without '/'
            if (this.isInArray(c, this.operator)) {
                return this._operatorToken(c);
            }
            
            // string such as '"' or "'"
            if (c === '"' || c === "'") {
                return this._stringToken(c);
            }
            
            // whitespace to fit the situation of keep the array-indent of source code 
            if (this.opt.isKeepArrayIndent && this.isArrayMode(this.tkConfig.mode) && this.isInArray(c, this.whitespace)) {
                var ret =  this._keepindentWhitespace(c);
                if (ret !== undefined && ret instanceof Array) {return ret};
            } else if (this.isInArray(c, this.whitespace)) {
            // normal whitespace
                var ret = this._normalWhitespace(c);
                if (ret !== undefined && ret instanceof Array) {return ret};
            }
            
            
            return [c, 'TK_UNKNOWN']
        },
        newLine: function (isIgonreRepeat) {
            this.output.push('\n');
            this.addLine = true;
            
            for (var i=0; i < this.tkConfig.indentLv; i++) {
                this.output.push(this.indentStr)
            }
        },
        _operatorToken: function (c) {
            while(this.parsePos < this.sourceLength && this.isInArray(c + this.source.charAt(this.parsePos), this.operator)) {
                c += this.source.charAt(this.parsePos);
                this.parsePos ++;
            }
            
            return [c, 'TK_OPERATOR'];
        },
        _normalWhitespace: function (c) {
            while(this.isInArray(this.source.charAt(this.parsePos), this.whitespace)) {
                /*if (c === '\n') {
                    this.blanklinesN += (this.opt.maxBlankLines ? (this.blanklinesN <= this.opt.maxBlankLines ? 1 : 0) : 1);
                }*/
                c += this.source.charAt(this.parsePos);
                if (this.parsePos > this.sourceLength) {
                    return ['', 'TK_EOF'];
                }
                
                this.parsePos ++;
            }
            return [c, 'TK_WHITESPACE'];
            /*if (this.opt.isBlankLinesRetain) {
                if (this.blanklinesN > 1) {
                    for (var i=0; i< this.blanklinesN; i++) {
                        this.newLine(i === 0);
                        this.addLine = true;
                    }
                }
            }
            this.wantNewline = (this.blanklinesN > 0);*/
            
        },
        _keepindentWhitespace: function (c) {
            var spaceCnt = 0;
            while(this.isInArray(c, this.whitespace)) {
                if (c === '\n') {
                    this.trimOutput(); // before push '\n'
                    this.output.push('\n');
                    this.addLine = true;
                    spaceCnt = 0;
                } 
                else if (c === '\t') {
                    spaceCnt += 4;    // plus spaceCnt to keep indent the source has
                }
                else if (c === '\r') {
                    // todo
                }
                else {
                    spaceCnt ++;
                }
                
                if (this.parsePos > this.sourceLength) {
                    return ['', 'TK_EOF']
                }
                // get next char
                c = this.source.charAt(this.parsePos);
                this.parsePos ++;
            }
            
            // set every newline's indentation
            if (this.tkConfig.baseIndentation === undefined) this.tkConfig.baseIndentation = spaceCnt;
            if (this.addline === true) {
                var i;
                for (i = 0; i < this.tkConfig.indentLv + 1; i++) {
                    this.output.push(this.indentStr)
                }
                if (this.tkConfig.baseIndentation !== undefined) {
                    for (i = 0; i < spaceCnt - this.tiConfig.baseIndentation; i++) {
                        this.output.push(' ');
                    }
                }
            }
            
        },
        _wordToken: function (c) {
            if (this.parsePos < this.sourceLength) {
                while(this.isInArray(this.source.charAt(this.parsePos), this.wordchar)) {
                    c += this.source.charAt(this.parsePos);
                    this.parsePos ++;
                    if (this.parsePos === this.sourceLength) break;
                }
            }
            return [c, 'TK_WORD'];
        },
        _commentToken: function (c) {
            var comment = '/*';
            // match inline comments /* ... */
            var isInline = true,
                curChar = this.source.charAt(this.parsePos);
            if (curChar === '*') {
                this.parsePos ++;
                if (this.parsePos < this.sourceLength) {
                    while(!(this.source.charAt(this.parsePos) === '*' && !!this.source.charAt(this.parsePos + 1) && this.source.charAt(this.parsePos + 1) === '/') && this.parsePos < this.sourceLength) { // exclude /**/, get content from /*, end as */
                        //comment content start after /*
                        c = this.source.charAt(this.parsePos);
                        if (c === '\x0d' || c === '\x0a') {
                            isInline = false;
                        }
                        comment += c;
                        
                        this.parsePos ++;
                        if (this.parsePos > this.sourceLength) {
                            break;
                        }
                    }
                }
                
                this.parsePos += 2;
                comment += '*/';
                if (isInline) {
                    return [comment, 'TK_INLINE_COMMENT'];
                } else {
                    return [comment, 'TK_BLOCK_COMMENT'];
                }
            }
            
            // match comment like //...
            if (curChar === '/') {
                comment = c;
                while(this.source.charAt(this.parsePos) !== '\r' && this.source.charAt(this.parsePos) !== '\n') {
                    comment += this.source.charAt(this.parsePos);
                    this.parsePos ++;
                    if (this.parsePos > this.sourceLength) {
                        break;
                    }
                }
                this.parsePos ++;
                
                return [comment+'\n', 'TK_COMMENT']
            }
        },
        _regexpToken: function (c) {
            var escape = false,
                ret = c;
            if (this.parsePos < this.sourceLength) {
                var retainExp = false;
                
                while((escape || retainExp || this.source.charAt(this.parsePos) !== c) && this.source.charAt(this.parsePos) !== '\n') {
                    var curChar = this.source.charAt(this.parsePos);
                    ret += curChar;
                    
                    if (!escape) {
                        if (curChar === '\\') escape = true;             // '/\\/'.charAt(1) === '\\'
                        if (curChar === '[') retainExp = true;             // '/[...' exp continue
                        else if (curChar === ']') retainExp = false;     // '/]....' exp search break
                    }
                    else {escape = false}
                    
                    this.parsePos ++;
                    // if regexp continue to the end of file, return
                    if (this.parsePos >= this.sourceLength) {
                        return [ret, 'TK_REGEXP']
                    }
                }
            }
            this.parsePos ++;
            ret += c;
            
            // regexp may have modifier like /regexp/ig
            // here we relax the rules of the modifiers, more than i,g,m...
            while(this.parsePos < this.sourceLength && this.isInArray(this.source.charAt(this.parsePos), this.wordchar)) {
                ret += this.source.charAt(this.parsePos);
                this.parsePos ++;
            }
            
            return [ret, 'TK_REGEXP'];
        },
        _stringToken: function (c) {
            var escape = false, 
                ret = c;
            if (this.parsePos < this.sourceLength) {
                while(escape || this.source.charAt(this.parsePos) !== c) {
                    var curChar = this.source.charAt(this.parsePos);
                    ret += curChar;
                    
                    if (!escape) {
                        if (curChar === '\\') escape = true;
                    } else escape = false;
                    
                    this.parsePos ++;
                    if (this.parsePos >= this.sourceLength) {
                        return [ret, 'TK_STRING']
                    }
                }
            }
            
            this.parsePos ++;
            ret += c;
            ret = this.encodeHtml(ret);
            
            return [ret, 'TK_STRING'];
        },
        setMode: function (mode) {
            // push previous token config
            if (!this.tkConfig) {
                this.tokenStore.push(this.tkConfig);
            }
            // define current token config
            this.tkConfig = {
                mode: mode,
                preMode: !!this.tkConfig ? this.tkConfig.mode : 'BLOCK',
                eatSpace: false,
                varLine: false,
                ifLine: false,
                varLineReindent: false,
                indentLv: (!!this.tkConfig ? this.tkConfig.indentLv + ((this.tkConfig.varLine && this.tkConfig.varLineReindent) ? 1 : 0) : 0)
            }
        },
        initialize: function () {
            //console.log(this.source);
            this.setMode('BLOCK');
            
            while(true) {
                var tk = this.getToken();
                
                if (tk[1] !== 'TK_WHITESPACE') {
                    // filter the whitespace
                    this.token.text = tk[0];
                    this.token.type = tk[1];
                    //log(tk)
                    if (tk[1] === 'TK_EOF') {
                        //log('eof');
                        break;
                    }
                    
                    this.preLastText = this.lastText;
                    this.preLastType = this.lastType;
                    this.lastText = this.token.text;
                    this.lastType = this.token.type;
                }
                this.highLight(tk);
            }
            
            return this.toHtml;
        },
        
        highLight: function (tk) {
            var cn = tk[1].toLowerCase();
            if (tk[1] === 'TK_WORD' && this.isInArray(tk[0], this.lineKeywords)) {
                this.toHtml += '<span class="tk_keywords">'+tk[0]+'</span>'
            }
            else if (tk[1] === 'TK_WORD' && this.isInArray(tk[0], this.jsKeywords)){
                this.toHtml += '<span class="tk_jskeywords">'+tk[0]+'</span>'
            }
            else {
                this.toHtml += '<span class="'+cn+'">'+tk[0]+'</span>'
            }
        }
    })
    
    this.jsFormat = jsFormat;
})();