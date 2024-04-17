import {type SyntaxNode} from "@lezer/common";
import {Source, SyntaxError} from "./source.ts";
import {NodeType} from "../parser";
import {isObject, isUndefined} from "./typed.ts";
import {visitChildren} from "./visitor.ts";

export const toValue = (source: Source, node: SyntaxNode | null): any => {
    if (!node) {
        return null
    }

    switch (node.type.id) {
        case NodeType.Document:
            let o: Record<string, any> | undefined = undefined;
            for (const c of visitChildren(node)) {
                if (c.type.is(NodeType.Comment)) {
                    continue
                }

                if (c.type.is(NodeType.Property)) {
                    if (!o) {
                        o = {}
                    }
                    const [props, value] = getPropsAndValue(source, c);
                    setObject(o, toKeyPath(source, props), toValue(source, value));
                } else {
                    if (o) {
                        throw new SyntaxError(source, c, "Property / Value could not in same scope")
                    }
                    return toValue(source, c)
                }
            }
            return o
        case NodeType.Object:
            const obj: Record<string, boolean> = {};

            for (const c of visitChildren(node)) {
                if (c.type.is(NodeType.Comment)) {
                    continue
                }

                if (c.type.is(NodeType.Property)) {
                    let [props, value] = getPropsAndValue(source, c);
                    setObject(obj, toKeyPath(source, props), toValue(source, value));
                }
            }
            return obj;
        case NodeType.Array:
            const arr: any[] = [];
            for (const c of visitChildren(node)) {
                if ((c.name == "[" || c.name == "]")) {
                    continue
                }
                arr.push(toValue(source, c));
            }
            return arr;
        case NodeType.Bytes:
            if (node.firstChild) {
                throw new SyntaxError(source, node, "invalid bytes")
            }

            const rawBytes = source.code.slice(node.from, node.to)
            if (rawBytes.startsWith(`'''`)) {
                return asBytes(normalizeIndent(rawBytes.substring(3, rawBytes.length - 3)))
            }
            return asBytes(eval(rawBytes))
        case NodeType.String:
            if (node.firstChild) {
                throw new SyntaxError(source, node, "invalid string")
            }

            const rawStr = source.code.slice(node.from, node.to)
            if (rawStr.startsWith(`"""`)) {
                return normalizeIndent(rawStr.substring(3, rawStr.length - 3))
            }
            return eval(rawStr)
        case NodeType.Number:
            if (node.firstChild) {
                throw new SyntaxError(source, node, "invalid number")
            }
            return parseFloat(source.code.slice(node.from, node.to));
        case NodeType.True:
            return true;
        case NodeType.False:
            return false;
        case NodeType.Null:
            return null;
        default:
            throw new SyntaxError(source, node)
    }
}


export function asBytes(s: string): Uint8Array {
    return new _Bytes((new TextEncoder()).encode(s))
}

class _Bytes extends Uint8Array {
    toJSON() {
        return btoa((new TextDecoder()).decode(this))
    }
}

function unquote(s: string) {
    try {
        return JSON.parse(s);
    } catch (_) {
        return s;
    }
}


function normalizeIndent(multiline: string): string {
    const ret = multiline.match(/^(([\n\r]+)[\t ]+)/)
    if (ret) {
        return multiline.replaceAll(ret[1], ret[2]).trimStart()
    }
    return multiline
}

function getPropsAndValue(source: Source, node: SyntaxNode): [SyntaxNode[], SyntaxNode] {
    const props: SyntaxNode[] = []
    let value: SyntaxNode | undefined = undefined

    for (const c of visitChildren(node)) {
        if (c.type.is(NodeType.PropertyName)) {
            props.push(c)
            continue
        }

        if (!isUndefined(value)) {
            throw new SyntaxError(source, c, "Property must only one value")
        }

        value = c;
    }

    if (props.length == 0) {
        throw new SyntaxError(source, node, "Property must have at least one PropertyName")
    }

    if (isUndefined(value)) {
        throw new SyntaxError(source, node, "Property must at least one value")
    }

    return [props, value]
}


function toKeyPath(source: Source, props: SyntaxNode[]): string[] {
    return props.map((prop) => unquote(source.code.slice(prop.from, prop.to)))
}

function setObject(o: Record<string, any>, keyPath: string[], v: any) {
    if (keyPath.length === 0) {
        return
    }

    if (keyPath.length === 1) {
        o[keyPath[0]] = v
        return
    }

    const [key, ...remain] = keyPath;

    if (isUndefined(o[key])) {
        o[key] = {};
    } else if (!isObject(o[key])) {
        throw new Error(`o[${key}] already have non-object value`)
    }

    return setObject(o[key], remain, v)
}