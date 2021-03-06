import { EventEmitter } from "events";
import { DiagnosticSeverity } from "vscode-languageserver/lib/main";

import { CommandErrorBuilder } from "./brigadier/errors";
import { StringReader } from "./brigadier/string-reader";
import { COMMENT_START, SPACE } from "./consts";
import { DataManager } from "./data/manager";
import {
    CommandNode,
    CommandNodePath,
    GlobalData,
    LocalData
} from "./data/types";
import {
    createParserInfo,
    getNextNode,
    isSuccessful,
    ReturnHelper
} from "./misc-functions";
import { getParser } from "./parsers/get-parser";
import {
    CommandContext,
    CommandData,
    FunctionInfo,
    ParseNode,
    ReturnedInfo,
    StoredParseResult
} from "./types";

const parseExceptions = {
    Ambiguity: new CommandErrorBuilder(
        "parsing.command.ambiguous",
        "Command text is possibly ambiguous",
        DiagnosticSeverity.Information
    ),
    NoSuccesses: new CommandErrorBuilder(
        "command.parsing.matchless",
        "No nodes which matched '%s' found"
    ),
    NotRunnable: new CommandErrorBuilder(
        "parsing.command.executable",
        "The command '%s' cannot be run.",
        DiagnosticSeverity.Warning
    )
};

export function parseCommand(
    text: string,
    globalData: GlobalData,
    localData: LocalData | undefined
): StoredParseResult | void {
    if (text.length === 0 || text.startsWith(COMMENT_START)) {
        return undefined;
    }
    const reader = new StringReader(text);
    const data: CommandData = { globalData, localData };
    const startingcontext: CommandContext = {};
    const recurse = parsechildren(
        reader,
        globalData.commands as any,
        [],
        data,
        startingcontext
    );
    const nodes: ParseNode[] = [];
    if (isSuccessful(recurse)) {
        nodes.push(...recurse.data);
    }
    return { actions: recurse.actions, nodes, errors: recurse.errors };
}

function parsechildren(
    reader: StringReader,
    node: CommandNode,
    path: CommandNodePath,
    data: CommandData,
    context: CommandContext
): ReturnedInfo<ParseNode[]> {
    const parent = getNextNode(node, path, data.globalData.commands);
    const helper = new ReturnHelper();
    const children = parent.node.children;
    if (children) {
        const nodes: ParseNode[] = [];
        const start = reader.cursor;
        let successCount = 0;
        let min: number = reader.getTotalLength();
        const originalErrorCount = helper.getShared().errors.length;
        for (const childKey of Object.keys(children)) {
            const child = children[childKey];
            const childpath = [...parent.path, childKey];
            const result = parseAgainstNode(
                reader,
                child,
                childpath,
                data,
                context
            );
            if (helper.merge(result)) {
                const childdata = result.data;
                const newContext = childdata.newContext
                    ? childdata.newContext
                    : context;
                const newNode: ParseNode = {
                    context,
                    final: newContext,
                    high: reader.cursor,
                    low: start,
                    path: childpath
                };
                function checkRead(): boolean {
                    if (reader.canRead()) {
                        return true;
                    } else {
                        if (!childdata.node.executable) {
                            helper.addErrors(
                                parseExceptions.NotRunnable.create(
                                    0,
                                    reader.cursor,
                                    reader.string
                                )
                            );
                        }
                        return false;
                    }
                }
                if (checkRead()) {
                    if (reader.peek() === SPACE) {
                        successCount++;
                        reader.skip();
                        if (checkRead()) {
                            const recurse = parsechildren(
                                reader,
                                childdata.node,
                                childpath,
                                data,
                                newContext
                            );
                            if (helper.merge(recurse)) {
                                min = Math.min(min, reader.cursor);
                                nodes.push(...recurse.data);
                                newNode.final = undefined;
                            }
                        }
                        nodes.push(newNode);
                    }
                } else {
                    successCount++;
                    nodes.push(newNode);
                }
            }
            reader.cursor = start;
        }
        if (successCount === 0) {
            if (helper.getShared().errors.length === originalErrorCount) {
                helper.addErrors(
                    parseExceptions.NoSuccesses.create(
                        reader.cursor,
                        reader.getTotalLength(),
                        reader.getRemaining()
                    )
                );
            }
            return helper.fail();
        }
        if (successCount > 1) {
            helper.addErrors(parseExceptions.Ambiguity.create(start, min));
        }
        return helper.succeed(nodes);
    } else {
        if (!(parent.node as CommandNode).executable) {
            mcLangLog(
                `Malformed tree at path ${JSON.stringify(
                    path
                )}. No children and not executable`
            );
        }
        return helper.fail();
    }
}

interface NodeParseSuccess {
    max: number;
    newContext?: CommandContext;
    node: CommandNode;
}

function parseAgainstNode(
    reader: StringReader,
    node: CommandNode,
    path: CommandNodePath,
    data: CommandData,
    context: CommandContext
): ReturnedInfo<NodeParseSuccess> {
    const parser = getParser(node);
    const helper = new ReturnHelper(false);
    if (!!parser) {
        try {
            const result = parser.parse(
                reader,
                createParserInfo(node, data, path, context, false)
            );
            if (!!result) {
                if (helper.merge(result)) {
                    const newContext = { ...context, ...result.data };
                    return helper.succeed<NodeParseSuccess>({
                        max: reader.cursor,
                        newContext,
                        node
                    });
                } else {
                    return helper.fail();
                }
            } else {
                return helper.succeed<NodeParseSuccess>({
                    max: reader.cursor,
                    node
                });
            }
        } catch (error) {
            mcLangLog(`Error thrown whilst parsing: ${error} - ${error.stack}`);
        }
    }
    return helper.fail();
}

export function parseLines(
    document: FunctionInfo,
    data: DataManager,
    emitter: EventEmitter,
    documentUri: string,
    lines: number[]
): void {
    for (const lineNo of lines) {
        const line = document.lines[lineNo];
        const packsInfo = data.getPackFolderData(document.pack_segments);
        let localData: LocalData | undefined;
        if (packsInfo && document.pack_segments) {
            localData = {
                ...packsInfo,
                current: packsInfo.packnamesmap[document.pack_segments.pack]
            };
        }
        const result = parseCommand(line.text, data.globalData, localData);
        line.parseInfo = result ? result : false;
        line.actions = undefined;
        line.nodes = undefined;
        emitter.emit(`${documentUri}:${lineNo}`);
    }
}

export function parseDocument(
    document: FunctionInfo,
    data: DataManager,
    emitter: EventEmitter,
    documentUri: string
): void {
    const lines = document.lines.map((_, i) => i);
    parseLines(document, data, emitter, documentUri, lines);
}
