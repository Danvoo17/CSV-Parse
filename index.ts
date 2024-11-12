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

		if (!config.delimiter) {
			return {
				result: false,
				error: `Configuration file '${configFilePath}' has no 'delimiter' parameter.`,
			};
		}

		if (!config.hasHeaders) {
			return {
				result: false,
				error: `Configuration file '${configFilePath}' has no 'hasHeaders' parameter.`,
			};
		}

		if (!config.separator) {
			return {
				result: false,
				error: `Configuration file '${configFilePath}' has no 'separator' parameter.`,
			};
		}

		if (!config.terminator) {
			return {
				result: false,
				error: `Configuration file '${configFilePath}' has no 'terminator' parameter.`,
			};
		}

		return { result: true, options: config };
	} catch (error) {
		return { result: false, error: `${error}` };
	}
}


function validateData(
	data: string[][],
): { isValid: false; error: string } | { isValid: true } {
	const expectedTypes = ["string", "number", "string", "string"];
	const maxLengths = [26, 2, 24, null];
	const genders = ["male", "female"];

	for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
		const row = data[rowIndex];

		if (row.length !== 4) {
			return {
				isValid: false,
				error: `Row ${rowIndex + 1} does not contain exactly 4 columns.`,
			};
		}

		for (let colIndex = 0; colIndex < row.length; colIndex++) {
			const value = row[colIndex];
			const expectedType = expectedTypes[colIndex];
			const maxLength = maxLengths[colIndex];

			// Validación de tipo y longitud de caracteres para columnas específicas
			if (colIndex === 1) {
				// Validación para age: debe ser un número de máximo 2 dígitos
				if (isNaN(Number(value)) || value.length > maxLength) {
					return {
						isValid: false,
						error: `Row ${rowIndex + 1}, column ${colIndex + 1} (age) should be a number with up to ${maxLength} characters.`,
					};
				}
			} else if (colIndex === 0 || colIndex === 2) {
				// Validación para name y profession
				if (typeof value !== "string" || value.length > maxLength) {
					return {
						isValid: false,
						error: `Row ${rowIndex + 1}, column ${colIndex + 1} (${colIndex === 0 ? "name" : "profession"}) exceeds maximum length of ${maxLength} characters.`,
					};
				}
			} else if (colIndex === 3) {
				// Validación para gender: debe ser "male" o "female"
				if (!genders.includes(value.toLowerCase())) {
					return {
						isValid: false,
						error: `Row ${rowIndex + 1}, column ${colIndex + 1} (gender) must be either "male" or "female".`,
					};
				}
			}
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

	console.info(data);
	return { isValid: true, data: [] };
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

// Parse the CSV file
const csvData = parseCSV(filePath, configuration.options);
if (!csvData.isValid) {
	console.error(csvData.error);
	process.exit(1);
}
   
// Validate the parsed CSV data against column requirements
const validation = validateData(csvData.data);
if (!validation.isValid) {
	console.error(validation.error);
	process.exit(1);
}

console.info("CSV data is valid and meets the column type and value requirements.");

