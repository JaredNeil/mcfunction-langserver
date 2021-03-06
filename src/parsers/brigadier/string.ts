import { ReturnHelper } from "../../misc-functions";
import { Parser } from "../../types";

export const stringParser: Parser = {
    parse: (reader, properties) => {
        const helper = new ReturnHelper(properties);
        switch (properties.node_properties.type) {
            case "greedy":
                reader.cursor = reader.string.length;
                return helper.succeed();
            case "word":
                reader.readUnquotedString();
                return helper.succeed();
            default:
                if (helper.merge(reader.readString())) {
                    return helper.succeed();
                } else {
                    return helper.fail();
                }
        }
    }
};
