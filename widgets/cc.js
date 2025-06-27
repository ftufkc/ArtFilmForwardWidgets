// Criterion Collection Widget
// ------------------------------------------------------------
//  数据来源： https://raw.githubusercontent.com/arrismo/criterioncollection/main/data-raw/criterion.csv
//  更新频率： 30 天（2628000 秒）
//  Author   : <your name>
// ------------------------------------------------------------

/* ==== 元数据 ==== */
WidgetMetadata = {
    id: "criterion",
    title: "The Criterion Collection 片单",
    version: "1.0.0",
    requiredVersion: "0.0.1",
    description:
        "使用 GitHub 数据集（arrismo/criterioncollection）生成完整片单，每月自动刷新",
    author: "ddueh",
    site: "https://github.com/arrismo/criterioncollection",
    modules: [
        {
            title: "Criterion Collection",
            requiresWebView: false,
            functionName: "loadCriterionItems",
            cacheDuration: 2628000, // 30 天
            params: [
                {
                    name: "page",
                    title: "页码",
                    type: "page",
                },
                {
                    name: "pageSize",
                    title: "每页条数",
                    type: "input",
                    value: 20,
                    description: "默认 20 条；>1000 部影片建议分页浏览",
                },
            ],
        },
    ],
};

/* ==== 常量 & 内存缓存 ==== */
const CSV_URL =
    "https://raw.githubusercontent.com/arrismo/criterioncollection/main/data-raw/criterion.csv";
let criterionCache = null; // 进程级缓存，避免同会话多次解析

/* ==== 工具函数 ==== */
// 基础 CSV 解析（不引入第三方库，简单 split 足够）
function parseCsv(text) {
    // 去掉首行表头再 split
    return text
        .trim()
        .split("\n")
        .slice(1)
        .map((line) => {
            // 简单场景：字段内无引号/逗号
            const [spine, year, country, title, director] = line
                .split(',"')
                .map((s) => s.replace(/^"|"$/g, "").trim());
            return {
                spine: Number(spine),
                year: year.trim(),
                country: country.trim(),
                title: title.trim(),
                director: director.trim(),
            };
        })
        .filter((row) => !Number.isNaN(row.spine));
}

/* ==== 数据拉取 ==== */
async function fetchCriterionData() {
    if (criterionCache) return criterionCache; // 命中内存

    const response = await Widget.http.get(CSV_URL, {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (compatible; CriterionWidget/1.0; +https://example.com)",
            Referer: "https://github.com/arrismo/criterioncollection",
        },
    });
    console.log("CSV 获取成功，长度:", response.data.length);

    criterionCache = parseCsv(response.data); // 缓存解析结果
    return criterionCache;
}

/* ==== 暴露给 Widget 的主函数 ==== */
async function loadCriterionItems(params = {}) {
    const page = params.page || 1;
    const pageSize = Number(params.pageSize) || 20;
    const startIdx = (page - 1) * pageSize;

    // 数据准备
    const list = await fetchCriterionData();

    // 分页切片
    const slice = list.slice(startIdx, startIdx + pageSize);

    /* 返回给宿主的卡片格式 —— 可自行按需求扩展字段 */
    return slice.map((item) => ({
        id: item.spine, // 以 spine 号做唯一 id
        type: "criterion",
        title: item.title,
        subtitle: `#${item.spine} · ${item.year} · ${item.country} · ${item.director}`,
        // 额外元信息放入 payload，供前端二次渲染
        payload: item,
    }));
}
