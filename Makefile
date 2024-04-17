test:
	bun test .

gen:
	bun --bunx lezer-generator src/parser/jsoncue.grammar -o src/parser/parser.ts