import { CommandErrorBuilder } from "../../brigadier/errors";
import { StringReader } from "../../brigadier/string-reader";
import {
    dimensions,
    effects,
    enchantments,
    entities,
    particles
} from "../../data/lists/statics";
import {
    convertToNamespace,
    parseNamespaceOption,
    ReturnHelper,
    stringifyNamespace
} from "../../misc-functions";
import { ContextChange, Parser, ParserInfo, ReturnedInfo } from "../../types";

export class NamespaceListParser implements Parser {
    private readonly error: CommandErrorBuilder;
    private readonly options: string[];
    public constructor(options: string[], errorBuilder: CommandErrorBuilder) {
        this.options = options;
        this.error = errorBuilder;
    }
    public parse(
        reader: StringReader,
        info: ParserInfo
    ): ReturnedInfo<ContextChange> {
        const helper = new ReturnHelper(info);
        const start = reader.cursor;
        const result = parseNamespaceOption(
            reader,
            this.options.map((v, _) => convertToNamespace(v))
        );
        if (helper.merge(result)) {
            return helper.succeed();
        } else {
            if (result.data) {
                return helper
                    .addErrors(
                        this.error.create(
                            start,
                            reader.cursor,
                            stringifyNamespace(result.data)
                        )
                    )
                    .succeed();
            } else {
                return helper.fail();
            }
        }
    }
}

const summonError = new CommandErrorBuilder(
    "entity.notFound",
    "Unknown entity: %s"
);
export const summonParser = new NamespaceListParser(entities, summonError);

const enchantmentError = new CommandErrorBuilder(
    "enchantment.unknown",
    "Unknown enchantment: %s"
);
export const enchantmentParser = new NamespaceListParser(
    enchantments,
    enchantmentError
);

const mobEffectError = new CommandErrorBuilder(
    "effect.effectNotFound",
    "Unknown effect: %s"
);
export const mobEffectParser = new NamespaceListParser(effects, mobEffectError);

const particleError = new CommandErrorBuilder(
    "particle.notFound",
    "Unknown particle: %s"
);
export const particleParser = new NamespaceListParser(particles, particleError);

const dimensionError = new CommandErrorBuilder(
    "argument.dimension.invalid",
    "Unknown dimension: '%s'"
);

export const dimensionParser = new NamespaceListParser(
    dimensions,
    dimensionError
);