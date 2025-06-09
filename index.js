import dotenv from "dotenv";
dotenv.config();

import {exec} from "node:child_process"
import Together from "together-ai";
import fs from "fs/promises";
import path from "path";


const together = new Together({
    apiKey: process.env.OPEN_AI_API_KEY
}); 

function getWeatherInfo(cityname){
    return `The weather in ${cityname} is sunny with a temperature of 25°C.`;
}


async function createFile(input) {
    try {
        const { filePath, content } = JSON.parse(input);

        const fullPath = path.resolve(filePath);
        const dir = path.dirname(fullPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(fullPath, content, "utf8");

        return `✅ File created at ${fullPath}`;
    } catch (error) {
        return `❌ Error creating file: ${error.message}`;
    }
}

async function createFolder(folderPath) {
    const fullPath = path.resolve(folderPath);
    try {
        await fs.mkdir(fullPath, { recursive: true });
        return `✅ Folder created at ${fullPath}`;
    } catch (err) {
        return `❌ Error creating folder: ${err.message}`;
    }
}


async function execCommand(command){
    try {
        return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`Error executing command: ${error.message}`);
            } else if (stderr) {
                reject(`Command error: ${stderr}`);
            } else {
                resolve(`stdout: ${stdout}`);
            }
        });
    });
        
    } catch (error) {
        console.error("Error executing command:", error);
        return JSON.stringify({error: error.message});
        
    }
}
const toolsMap={
    getWeatherInfo: getWeatherInfo,
    execCommand: execCommand,
    createFile: createFile,
    createFolder: createFolder
}

const SYSTEM_PROMPT=`
You are an helpful AI  Assistant who is designed to solve user query.
You work on START, THINK, ACTION, OBSERVE and OUTPUT mode.

In the start phase user gives a query to you.
then you THINK how to resolve a query atleast 4-5 times and make sure that all is clear.
If there is a need to call a tool, you call an ACTION event with tool and input parameters.
If there is an action call, wait for the OBSERVE that is output of  the tool.
Based on the OBSERVE from the previous step, you either output or repeat the process.


Available Tools:
- getWeatherInfo(cityname: string): string
- execCommand(command: string): Promise<string> Execute a shell commands and return the stdout and the stderr if any.
- createFile(input: string): Promise<string> Creates a file with given content. Input must be a JSON string with "filePath" and "content".
- createFolder(folderPath: string): Promise<string> Creates a folder at the specified path.

Important Rules:
- You must never output the final result (OUTPUT) unless all ACTIONS have been executed and        OBSERVEs are received.
- Each ACTION must be followed by an OBSERVE.
- After OBSERVE, think again, and only then OUTPUT.
- Never skip THINK and OBSERVE steps before OUTPUT.
- If an ACTION is required, stop and wait for the tool to execute.


Example:
START:what is weather of delhi?
THINK:The user is asking for the weather of delhi.
THINK: from the available tools, I must call getWeatherInfo tool for delhi as input.
ACTION: Call tool getWeatherInfo(delhi)
OBSERVE: The weather in delhi is sunny with a temperature of 25°C.
THINK: The output of getWeatherInfo tool is The weather in delhi is sunny with a temperature of 25°C.
OUTPUT: The weather in delhi is sunny with a temperature of 25°C.

Output Example:
{"role":"user", "content":"what is the weather of delhi ?"}
{"step":"think", "content":"The user is asking for the weather of delhi."}
{"step":"think", "content":"from the available tools, I must call getWeatherInfo tool for delhi as input."}
{"step":"action", "tool":"getWeatherInfo", "input":"delhi", "content":""}
{"step":"observe", "content":"The weather in delhi is sunny with a temperature of 25°C."}
{"step":"think", "content":"The output of getWeatherInfo tool is The weather in delhi is sunny with a temperature of 25°C."}
{"step":"output", "content":"The weather in delhi is sunny with a temperature of 25°C."}

Output Format:
{"step":"string", "tool":"string", "input": "string", "content": "string"}

`;

async function init() {
    const messages=[
    {
        role:"system",
        content: SYSTEM_PROMPT
    }
]

const userQuery="create a HTML file for designing a basic calculator with css and js code in the HTML file. It is fully working and attractive UI.";

messages.push({role:"user", content:userQuery})
while(true){
const response=await together.chat.completions.create({
    model: "deepseek-ai/DeepSeek-V3",
    response_format:{type:"json_object"},
    messages: messages,
})


messages.push({role:"assistant", content:response.choices[0].message.content})

const parseQuery=JSON.parse(response.choices[0].message.content);

if(parseQuery.step && parseQuery.step==="think"){
    console.log(`🤯: ${parseQuery.content} `);
    continue;
}

if(parseQuery.step && parseQuery.step === "output") {
    const previousActions = messages.filter(m => {
        try {
            const c = JSON.parse(m.content);
            return c.step === "action";
        } catch (e) {
            return false;
        }
    });

    const previousObserves = messages.filter(m => {
        try {
            const c = JSON.parse(m.content);
            return c.step === "observe";
        } catch (e) {
            return false;
        }
    });

    if (previousActions.length === previousObserves.length) {
        console.log(`🤖: ${parseQuery.content} `);
        break;
    } else {
        continue;
    }
}


if(parseQuery.step && parseQuery.step==="action"){
    const tool=parseQuery.tool
    const input=parseQuery.input
    const actionMessage=await toolsMap[tool](input)
    console.log(actionMessage)
    console.log(`🛠️: Tool call ${tool}: (${input}): (${actionMessage})`);
    messages.push({
        role:"assistant", 
        content:JSON.stringify({step:"observe", content:actionMessage})
    })
    continue;
}

}
}

init();