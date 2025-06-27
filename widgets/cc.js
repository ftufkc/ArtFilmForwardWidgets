/*
 * @name: Criterion Collection
 * @id: cc
 * @description: 展示 Criterion Collection 的电影信息
 * @author: Your Name
 * @version: 1.0.0
 * @feed: https://raw.githubusercontent.com/arrismo/criterioncollection/master/data/criterion.csv
 */

// 定义小组件的元数据
var metadata = {
    // 小组件的唯一标识符
    id: "cc",
    // 小组件的标题
    title: "Criterion Collection",
    // 小组件的描述
    description: "展示 Criterion Collection 的电影信息",
    // 作者
    author: "ddueh",
    // 版本号
    version: "1.0.0",
};

// 小组件的主体实现
// 'body' 函数是小组件的入口点，它负责获取和处理数据，并返回要在界面上显示的内容。
// 'params' 对象包含了用户在小组件界面上输入的参数。
async function body(params) {
    // Criterion Collection 数据源的 URL
    // 我们假设数据是以 CSV 格式提供的
    const url = "https://raw.githubusercontent.com/arrismo/criterioncollection/master/data/criterion.csv";

    try {
        // 1. 发送 HTTP GET 请求获取数据
        const response = await http.get(url);

        // 2. 解析 CSV 数据
        // 我们收到的 response.data 是一个字符串，需要将其解析成一个对象数组
        const records = parseCSV(response.data);

        // 3. 将解析后的数据转换成 Forward Widget 所需的格式
        // 我们遍历 'records' 数组，并为每条记录创建一个对象
        const items = records.map(record => ({
            // 'id' 是每个项目的唯一标识符，这里我们使用 spine_number
            id: record.spine_number,
            // 'title' 是项目的主标题
            title: record.title,
            // 'subtitle' 是项目的副标题，这里我们显示导演和年份
            subtitle: `${record.director} (${record.year})`,
            // 'url' 是点击项目时跳转的链接，这里我们链接到 Criterion 的官方网站
            url: `https://www.criterion.com/films/${record.spine_number}`,
        }));

        // 4. 返回格式化后的数据
        // 'items' 数组将被 Forward 用来渲染列表
        return {
            items: items,
        };
    } catch (error) {
        // 如果在获取或处理数据的过程中发生错误，我们将其记录到控制台，并抛出异常
        console.error("处理失败:", error);
        throw error;
    }
}

/**
 * 解析 CSV 字符串并返回一个对象数组
 * @param {string} csvText - 要解析的 CSV 格式的字符串
 * @returns {Array<Object>} - 解析后的对象数组
 */
function parseCSV(csvText) {
    // 按行分割 CSV 文本
    const lines = csvText.trim().split('\n');
    // 第一行是表头，包含列名
    const headers = lines[0].split(',').map(header => header.trim().replace(/"/g, ''));
    // 从第二行开始是数据行
    const records = lines.slice(1).map(line => {
        // 按逗号分割行数据
        const values = line.split(',').map(value => value.trim().replace(/"/g, ''));
        // 创建一个对象，将表头和数据行对应起来
        return headers.reduce((obj, header, index) => {
            obj[header] = values[index];
            return obj;
        }, {});
    });
    return records;
}