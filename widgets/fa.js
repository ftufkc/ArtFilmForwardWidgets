WidgetMetadata = {
    id: "fa",
    title: "Film Archive",
    version: "1.2.3",
    requiredVersion: "0.0.1",
    description: "中国电影资料馆与上海电影资料馆是中国大陆重要的电影档案与放映机构，本合集用于追踪其策划的展映片单",
    author: "ddueh",
    modules: [{
        id: "fa",
        title: "Film Archive",
        functionName: "getCollections",
        cacheDuration: 86400,
        params: []
    }]
};

async function getCollections(params = {}) {
    const response = await Widget.http.get("https://forward.lilychou.cn/api/data");
    let data = response.data;
    return getRandomArray(data);
}

function getRandomArray(arr) {
    return arr.slice().sort(() => Math.random() - 0.5);
}
