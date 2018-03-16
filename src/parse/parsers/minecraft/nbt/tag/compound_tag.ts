import { CommandErrorBuilder } from "../../../../../brigadier_components/errors";
import { StringReader } from "../../../../../brigadier_components/string_reader";
import { NBTWalker } from "../doc_walker";
import { parseTag } from "../tag_parser";
import { NBTError } from "../util/nbt_error";
import {
    COMPOUND_END,
    COMPOUND_KEY_VALUE_SEP,
    COMPOUND_PAIR_SEP,
    COMPOUND_START,
    expectAndScope,
    NBTHighlightAction,
    NBTHoverAction,
    parseStringNBT,
    throwIfFalse,
} from "../util/nbt_util";
import { NBTTag } from "./nbt_tag";

const NO_KEY = new CommandErrorBuilder("argument.nbt.compound.nokey", "Expected key");
const NO_VAL = new CommandErrorBuilder("argument.nbt.compound.noval", "Expected value");
const NO_END = new CommandErrorBuilder("argument.nbt.compound.noend", "Expected ',' or '}' at end of value");

export class NBTTagCompound extends NBTTag<{ [key: string]: NBTTag<any> }> {

    public tagType: "compound" = "compound";

    private keyPos: number[][] = [];
    private scopes: NBTHighlightAction[] = [];

    public getHover() {
        const out: NBTHoverAction[] = [];
        this.keyPos.forEach(
            (pos) => out.push({
                data: (path, root) => {
                    const walk = new NBTWalker(root);
                    const node = walk.getFinalNode(path);
                    return () => node !== undefined ? node.description || "" : "";
                },
                end: pos[1],
                start: pos[0],
            }),
        );
        Object.keys(this.val).forEach(
            (v) => out.push(
                ...this.val[v].getHover().map((v1) => ({
                    data: v1.data,
                    end: v1.end,
                    path: [v, ...(v1.path || [])],
                    start: v1.start,
                } as NBTHoverAction)),
            ),
        );
        return out;
    }

    public getHighlight() {
        return this.scopes.concat({
            end: this.end,
            scopes: ["compound"],
            start: this.start,
        });
    }

    public getVal() {
        return this.val;
    }

    public _parse(reader: StringReader) {
        const start = reader.cursor;
        expectAndScope(reader, COMPOUND_START, ["compound", "start"], {}, 0);
        let next = ",";
        const keys = [];
        while (next !== COMPOUND_END) {

            reader.skipWhitespace();

            throwIfFalse(
                reader.canRead(),
                NO_KEY.create(reader.cursor, reader.cursor),
                { parsed: this, keys, part: "key", path: [] },
                2,
            );
            const keyS = reader.cursor;
            const key = parseStringNBT(reader);
            keys.push(key);
            this.keyPos.push([keyS, reader.cursor]);

            reader.skipWhitespace();

            expectAndScope(
                reader,
                COMPOUND_KEY_VALUE_SEP,
                ["compound", "key-value", "separator"],
                { completions: [COMPOUND_KEY_VALUE_SEP], keys, parsed: this, part: "key", path: [key] },
                2,
            );

            reader.skipWhitespace();

            throwIfFalse(
                reader.canRead(),
                NO_VAL.create(reader.cursor, reader.cursor),
                { parsed: this, keys, part: "value", path: [key] },
                2,
            );
            let val: NBTTag<any>;

            reader.skipWhitespace();

            try {
                val = parseTag(reader);
            } catch (e) {
                throw new NBTError(e, { parsed: this, keys, part: "value", path: [key, ...e] }, 2);
            }
            this.val[key] = val;

            reader.skipWhitespace();

            next = reader.peek();
            if (next !== COMPOUND_PAIR_SEP && next !== COMPOUND_END) {
                throw new NBTError(
                    NO_END.create(start, reader.cursor),
                    { parsed: this, keys, part: "value", completions: [COMPOUND_PAIR_SEP, COMPOUND_END], path: [key] },
                    2,
                );
            }
        }
        this.correct = 2;
    }

    public tagEq(tag: NBTTag<any>): boolean {
        if (tag.tagType !== this.tagType) {
            return false;
        }
        return Object.keys(this.val).length === Object.keys(tag.getVal()).length && Object.keys(this.val).every(
            (v) => this.val[v].tagEq(((tag as NBTTagCompound).val)[v]),
        );
    }
}
