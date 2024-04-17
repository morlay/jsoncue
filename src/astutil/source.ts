import {parser} from "../parser";
import type {Tree, SyntaxNode} from "@lezer/common";
import {EditorState} from "@codemirror/state";

export class Source {
    static parse = (code: string): Source => {
        return new Source(parser.parse(code), code)
    }

    constructor(
        public tree: Tree,
        public code: string,
    ) {
    }

    get topNode(): SyntaxNode {
        return this.tree.topNode
    }
}

export class SyntaxError extends Error {
    constructor(
        public source: Source,
        public node: SyntaxNode,
        public reason = "",
    ) {
        const state = EditorState.create({
            doc: source.code
        })

        const line = state.doc.lineAt(node.from)
        const prefix = `${line.number} | `

        super(`SyntaxError${reason ? `: ${reason}` : ""}
${prefix}${state.sliceDoc(line.from, line.to)}        
${new Array(prefix.length + (node.from - line.from - 1)).fill(" ").join("")} ^ at position ${node.from}        
`)
    }
}

