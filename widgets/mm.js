WidgetMetadata = {
    id: "mm",
    title: "MOViE MOViE",
    version: "1.2.4",
    requiredVersion: "0.0.1",
    description: "MOViE MOViE電視頻道片單追蹤",
    author: "ddueh",
    modules: [{
        id: "mm",
        title: "MOViE MOViE",
        functionName: "getCollections",
        cacheDuration: 3600,
        params: []
    }]
};

async function getCollections(params = {}) {
    const response = await Widget.http.get("https://forward.lilychou.cn/api/mmdata");
    let data = response.data.data;
    return getRandomArray(data);
}

function getRandomArray(arr) {
    return arr.slice().sort(() => Math.random() - 0.5);
}
