import {isArray, isFunction, isNumber, isObject, isString, isUndefined} from "./typed.ts";
import {Printer} from "./printer.ts";

export function stringify(v: any): string {
    const w = new writer()
    w.print(v);
    return w.toString();
}

class writer {
    #p = new Printer()

    toString() {
        return this.#p.toString()
    }

    print(v: any): void {
        if (isArray(v)) {
            if (v.length == 0) {
                this.#p.write("[]")
                return
            }

            this.#p.write("[")
            this.#p.break()

            this.#p.withIdent(() => {
                for (const item of v) {
                    if (!isValidJSONValue(item)) {
                        continue
                    }
                    this.#p.tab()
                    this.print(item)
                    this.#p.write(",")
                    this.#p.break()
                }
            })

            this.#p.tab()
            this.#p.write("]")
            return
        }

        if (isObject(v)) {
            const entities = Object.entries(v)
                .filter(([k, v]) => isValidJSONValue(v))

            if (entities.length == 0) {
                this.#p.write("{}")
            }


            if (entities.length == 1) {
                const [prop, value] = entities[0]
                this.#p.write(stringifyProp(prop))
                this.#p.write(": ")
                this.print(value)
                return
            }

            this.#p.write("{")
            this.#p.break()

            this.#p.withIdent(() => {
                const propNames: Record<string, string> = {}

                let propMaxLength = 0

                for (const [prop, v] of entities) {
                    propNames[prop] = stringifyProp(prop)

                    const n = propNames[prop].length
                    if (n > propMaxLength) {
                        propMaxLength = n
                    }
                }

                for (const [prop, v] of entities) {
                    const fixedProp = propNames[prop]!

                    this.#p.tab()
                    this.#p.write(fixedProp)
                    this.#p.write(": ")
                    this.#p.space(propMaxLength - fixedProp.length)
                    this.print(v)
                    this.#p.break()
                }
            })

            this.#p.tab()
            this.#p.write("}")
            return
        }

        if (isString(v)) {
            if (isBase64(v)) {
                const s = atob(v)

                if (isMultiline(s)) {
                    this.#writeMultiline(s, `'''`)
                    return
                }

                this.#p.write(quote(s, "'"))
                return
            }

            if (isMultiline(v)) {
                this.#writeMultiline(v, `"""`)
                return
            }

            this.#p.write(quote(v, `"`))
            return
        }

        this.#p.write(JSON.stringify(v))
        return
    }

    #writeMultiline(v: string, quote: string) {
        this.#p.write(quote)
        this.#p.break()

        this.#p.withIdent(() => {
            for (const l of lines(v)) {
                this.#p.tab()
                this.#p.write(l)
                this.#p.break()
            }

            this.#p.tab()
            this.#p.write(quote)
        })

        return
    }
}

function stringifyProp(prop: string) {
    if (isValidIdentity(prop)) {
        return prop
    }
    return JSON.stringify(prop)
}

function isValidJSONValue(v: any) {
    return !(isUndefined(v) || isFunction(v))
}

function isValidIdentity(v: string) {
    return /[_$A-Za-z0-9]+/.test(v)
}

function isMultiline(v: string) {
    return /[\r\n]/.test(v)
}

function quote(s: string, q: string): string {
    return `${q}${s.split("").map((c) => {
        if (c == q) {
            return "\\" + q
        }
        return c
    }).join("")}${q}`
}

function* lines(s: string): Iterable<string> {
    const breaks = "\r\n"

    let start = 0;
    let breakChar = ""

    for (let end = 0; end < s.length; end++) {
        const char = s.charAt(end)
        if (breaks.includes(char)) {
            if (breakChar && breakChar != "\r") {
                continue
            }

            if (end == 0) {
                yield ""
                start = end + 1
                continue
            }

            yield s.slice(start, end)
            start = end + 1
        }
    }
}


const reBase64 = /^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+/]{3}=)?$/

function isBase64(v: string) {
    return reBase64.test(v)
}