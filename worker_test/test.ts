/// <reference lib="webworker" />

self.onmessage = async (message) => {
    console.log("worker received", message.data);
    if (message.data === "stop") {
        self.close();
        return;
    }
};

for (let i = 0; i < 10; i++) {
    // read file_1.txt
    const file = await Deno.readTextFile(
        new URL("./file_1.txt", import.meta.url),
    );
    console.log("worker", file);
    await new Promise((resolve) => setTimeout(resolve, 1000));
}
