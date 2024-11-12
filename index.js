"use strict";
/*
  Customer states: Application generates a CSV export of personnel data;
  upon attempting to import this data to Microsoft SQL Server, data is
  corrupted; please diagnose and advise.

  CSV is formatted exactly as table is defined: (varchar, integer, varchar, varchar).
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
function getConfigurationOptions(configFilePath) {
    try {
        const config = JSON.parse(node_fs_1.default.readFileSync(configFilePath).toString("utf-8"));
        if (!config.delimiter || !config.hasHeaders || !config.separator || !config.terminator) {
            return {
                result: false,
                error: `Configuration file '${configFilePath}' is missing required parameters.`,
            };
        }
        return { result: true, options: config };
    }
    catch (error) {
        return { result: false, error: `${error}` };
    }
}
// Validación de cada campo de la columna en validateData
function validateData(data) {
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (row.length !== 4) {
            console.info('final validation result:');
            console.error({ isValid: false });
            return { isValid: false, error: `Row ${i + 1} does not have exactly 4 columns.` };
        }
        // Validación columna por columna
        if (row[0].length > 26) {
            console.info('final validation result:');
            console.error({ isValid: false });
            return { isValid: false, error: `Error in "name" at row ${i + 1}: exceeds 26 characters.` };
        }
        if (!/^[0-9]{1,2}$/.test(row[1])) {
            console.info('final validation result:');
            console.error({ isValid: false });
            return { isValid: false, error: `Error in "age" at row ${i + 1}: must be a number with max 2 digits.` };
        }
        if (row[2].length > 24) {
            console.info('final validation result:');
            console.error({ isValid: false });
            return { isValid: false, error: `Error in "profession" at row ${i + 1}: exceeds 24 characters.` };
        }
        if (row[3].toLowerCase() !== "male" && row[3].toLowerCase() !== "female") {
            console.info('final validation result:');
            console.error({ isValid: false });
            return { isValid: false, error: `Error in "gender" at row ${i + 1}: must be either "male" or "female".` };
        }
    }
    return { isValid: true };
}
// Lógica de parseo en parseCSV
function parseCSV(filePath, options) {
    const csvData = node_fs_1.default
        .readFileSync(filePath, "utf-8")
        .toString()
        .replace(/\r\n/g, "\n");
    let currentState = undefined;
    const scanCharacter = (char, lookAhead, config, currentState) => {
        if (currentState === "insideDelimiter" && char !== config.delimiter) {
            return "insideDelimiter";
        }
        switch (char) {
            case config.delimiter:
                if (currentState === "insideDelimiter") {
                    currentState = "endDelimiter";
                    if (lookAhead !== config.separator &&
                        lookAhead !== config.terminator &&
                        lookAhead !== undefined) {
                        return "error";
                    }
                    return "endDelimiter";
                }
                else {
                    return "startDelimiter";
                }
            case config.separator:
                if (lookAhead !== config.delimiter && lookAhead !== config.terminator) {
                    return "error";
                }
                return "atSeparator";
            case config.terminator:
                if (lookAhead && lookAhead !== config.delimiter) {
                    return "error";
                }
                return "atTerminator";
            default:
                if (currentState === "startDelimiter" ||
                    currentState === "insideDelimiter") {
                    return "insideDelimiter";
                }
                return "error";
        }
    };
    const data = [];
    let currentDataArray = [];
    let currentPosition = 0;
    let currentWord = "";
    for (const character of csvData) {
        const lookAhead = currentPosition < csvData.length
            ? csvData[currentPosition + 1]
            : undefined;
        currentState = scanCharacter(character, lookAhead, options, currentState);
        console.info(`${currentPosition}: '${character}' : [${currentState}] => ${lookAhead}`);
        if (currentState === "startDelimiter") {
            currentWord = "";
        }
        if (currentState === "insideDelimiter") {
            currentWord += character;
        }
        if (currentState === "endDelimiter") {
            currentDataArray.push(currentWord);
            currentWord = "";
        }
        if (currentState === "atTerminator") {
            data.push(currentDataArray);
            currentDataArray = [];
        }
        if (currentState === "error") {
            return {
                isValid: false,
                error: `Character at position ${currentPosition + 1} is invalid.`,
            };
        }
        currentPosition += 1;
    }
    console.info('-');
    console.info('First validation result:');
    return { isValid: true, data };
}
const filePath = "samples/sample.csv";
const configPath = "config.json";
if (!filePath || !configPath) {
    console.error("File and configuration paths are required.");
    process.exit(1);
}
const configuration = getConfigurationOptions(configPath);
if (!configuration.result) {
    console.error(configuration.error);
    process.exit(1);
}
const csvData = parseCSV(filePath, configuration.options);
if (!csvData.isValid) {
    console.error(csvData.error);
    process.exit(1);
}
else {
    console.info(csvData);
}
const validationResult = validateData(csvData.data);
if (!validationResult.isValid) {
    console.error(validationResult.error);
    process.exit(1);
}
console.info('final validation result:');
console.info({ isValid: true });
console.info("[CSV data is valid and meets the column type and value requirements.]");
console.info('-');
//# sourceMappingURL=index.js.map