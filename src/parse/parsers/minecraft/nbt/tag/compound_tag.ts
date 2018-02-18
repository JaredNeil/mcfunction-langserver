import { CommandErrorBuilder } from "../../../../../brigadier_components/errors";
import { StringReader } from "../../../../../brigadier_components/string_reader";
import { SubAction } from "../../../../../types";
import { parseTag } from "../tag_parser";
import { NBTError } from "../util/nbt_error";
import { parseStringNBT, throwIfFalse, tryWithData } from "../util/nbt_util";
import { NBTTag } from "./nbt_tag";

const NO_KEY = new CommandErrorBuilder("argument.nbt.compound.nokey", "Expected key");
const NO_VAL = new CommandErrorBuilder("argument.nbt.compound.noval", "Expected value");
const NO_END = new CommandErrorBuilder("argument.nbt.compound.noend", "Expected ',' or '}' at end of value");

export const COMPOUND_OPEN = "{";
export const COMPOUND_CLOSE = "}";
export const KEYVAL_SEP = ":";
export const SEP = ",";

export class NBTTagCompound extends NBTTag {

    public tagType: "compound" = "compound";

    private val: { [key: string]: NBTTag };

    private keyPos: number[][] = [];

    constructor(val: { [key: string]: NBTTag } = {}) {
        super();
        this.val = val;
    }

    public getActions() {
        const out: SubAction[] = [];
        for (const pos of this.keyPos) {
            out.push({
                data: this.getStringValue().slice(pos[0], pos[1]),
                high: pos[1],
                low: pos[0],
                type: "hover",
            });
        }
        Object.keys(this.val).forEach(
            (v) => out.push(...this.val[v].getActions()),
        );
        return out;
    }

    public getVal() {
        return this.val;
    }

    public _parse(reader: StringReader) {
        const start = reader.cursor;
        tryWithData(() => reader.expect(COMPOUND_OPEN), {}, 0);
        let next = ",";
        const keys = [];
        while (next !== COMPOUND_CLOSE) {
            throwIfFalse(
                reader.canRead(),
                NO_KEY.create(reader.cursor, reader.cursor),
                { parsed: this, keys, part: "key" },
                2,
            );
            const keyS = reader.cursor;
            const key = parseStringNBT(reader);
            keys.push(key);
            this.keyPos.push([keyS, reader.cursor]);
            tryWithData(() => reader.expect(KEYVAL_SEP), { parsed: this, keys, completions: [KEYVAL_SEP] }, 2);
            throwIfFalse(
                reader.canRead(),
                NO_VAL.create(reader.cursor, reader.cursor),
                { parsed: this, keys, part: "value" },
                2,
            );
            let val: NBTTag;
            try {
                val = parseTag(reader);
            } catch (e) {
                throw new NBTError(e, { parsed: this, keys, part: "value" }, 2);
            }
            this.val[key] = val;
            next = reader.peek();
            if (next !== SEP && next !== COMPOUND_CLOSE) {
                throw new NBTError(NO_END.create(start, reader.cursor), { parsed: this, keys, part: "value" }, 2);
            }
        }
        this.correct = 2;
    }
}
