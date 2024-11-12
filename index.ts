/*
  Customer states: Application generates a CSV export of personnel data;
  upon attempting to import this data to Microsoft SQL Server, data is
  corrupted; please diagnose and advise.

  CSV is formatted exactly as table is defined: (varchar, integer, varchar, varchar).
*/

import fs from "node:fs";

type ConfigParameters = {
	delimiter: '"' | "'";
	terminator: "\n";
	separator: "," | ";" | "|";
	hasHeaders: boolean;
};


function getConfigurationOptions(
	configFilePath: string,
):
	| { result: true; options: ConfigParameters }
	| { result: false; error: string } {
	try {
		const config: ConfigParameters = JSON.parse(
			fs.readFileSync(configFilePath).toString("utf-8"),
		);

		if (!config.delimiter || !config.hasHeaders || !config.separator || !config.terminator) {
			return {
				result: false,
				error: `Configuration file '${configFilePath}' is missing required parameters.`,
			};
		}

		return { result: true, options: config };
	} catch (error) {
		return { result: false, error: `${error}` };
	}
}



function validateData(
	data: string[][],
): { isValid: true } | { isValid: false; error: string } {
	for (let i = 0; i < data.length; i++) {
		const row = data[i];

		if (row[0].length > 26) {
			console.info('final validation result:')
			console.error({isValid: false});
			return { isValid: false, error: `Error in "name" at row ${i + 1}: exceeds 26 characters.` };
		}
		if (!/^[0-9]{1,2}$/.test(row[1])) {
			console.info('final validation result:')
			console.error({ isValid: false});
			return { isValid: false, error: `Error in "age" at row ${i + 1}: must be a number with max 2 digits.` };
		}
		if (row[2].length > 24) {
			console.info('final validation result:')
			console.error({ isValid: false});
			return { isValid: false, error: `Error in "profession" at row ${i + 1}: exceeds 24 characters.` };
		}
		if (row[3].toLowerCase() !== "male" && row[3].toLowerCase() !== "female") {
			console.info('final validation result:')
			console.error({ isValid: false});
			return { isValid: false, error: `Error in "gender" at row ${i + 1}: must be either "male" or "female".` };
		}
	}

	return { isValid: true };
}


function parseCSV(
	filePath: string,
	options: ConfigParameters,
): { isValid: true; data: string[][] } | { isValid: false; error: string } {
	const csvData = fs
		.readFileSync(filePath, "utf-8")
		.toString()
		.replace(/\r\n/g, "\n");

	type ParseState =
		| "startDelimiter"
		| "insideDelimiter"
		| "endDelimiter"
		| "atSeparator"
		| "atTerminator"
		| "error"
		| undefined;

	let currentState: ParseState = undefined;

	const scanCharacter = (
		char: string,
		lookAhead: string | undefined,
		config: ConfigParameters,
		currentState: ParseState,
	): ParseState => {
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
					return "endDelimiter"
				} else {
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
				if (
					currentState === "startDelimiter" ||
					currentState === "insideDelimiter"
				) {
					return "insideDelimiter";
				}
				return "error";
		}
	};

	const data: string[][] = [];
	let currentDataArray: string[] = [];
	let currentPosition = 0;
	let currentWord = "";
	for (const character of csvData) {
		const lookAhead =
			currentPosition < csvData.length
				? csvData[currentPosition + 1]
				: undefined;
		currentState = scanCharacter(character, lookAhead, options, currentState);
		console.info(
			`${currentPosition}: '${character}' : [${currentState}] => ${lookAhead}`,
		);

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
				error: `Character at position ${currentPosition+1} is invalid.`,
			};
		}
		currentPosition += 1;
	}

    console.info('-')
	console.info('First validation result:')
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
} else {
	console.info(csvData)
}

const validationResult = validateData(csvData.data);
if (!validationResult.isValid) {
	console.error(validationResult.error);
	process.exit(1);
}


console.info('final validation result:')
console.info({isValid: true})
console.info("[CSV data is valid and meets the column type and value requirements.]");
console.info('-')
