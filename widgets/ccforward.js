/**
 * @file cc.js
 * @description Forward widget for browsing the Criterion Collection.
 * Fetches the master list as a CSV from arrismo/criterioncollection and enriches it with metadata from TMDB.
 * @version 1.1.0
 */

// 1. Widget Metadata
WidgetMetadata = {
    id: "criterion_collection",
    title: "Criterion Collection",
    version: "1.1.0",
    requiredVersion: "0.0.1",
    description: "完整的标准收藏(CC)电影列表",
    author: "ddueh",
    modules: [{
        id: "cc",
        title: "Criterion Collection 电影列表",
        functionName: "getCollectionPage",
        params: [{
            name: "page",
            title: "页码",
            type: "page"
        }]
    }]
};


const ITEMS_PER_PAGE = 20;
const CRITERION_DATA_URL = 'https://raw.githubusercontent.com/arrismo/criterioncollection/main/data-raw/criterion.csv';
let criterionList = []; // 初始化为一个空数组，缓存 Criterion Collection 完整列表


/**
 * 主函数，由 Forward 框架调用。
 * @param {object} params - 框架传递的参数，包含 { page: number }。
 * @returns {Promise<Array<object>>} - 返回一个符合 Forward 数据模型的对象数组。
 */
async function getCollectionPage(params = {}) {
    try {
        await fetchAndCacheCriterionData();

        const page = params.page || 1;
        const startIndex = (page - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const pageItems = criterionList.slice(startIndex, endIndex);

        const enrichedItems = await enrichItemsWithTmdb(pageItems);
        return mapToForwardDataModel(enrichedItems);

    } catch (error) {
        console.error("处理 Criterion Collection 列表失败:", error);
        throw error;
    }
}

/**
 * 辅助函数：获取、解析并缓存 Criterion Collection 的 CSV 电影列表。
 */
async function fetchAndCacheCriterionData() {
    if (criterionList.length > 0) {
        return; // 数据已缓存
    }
    console.log("正在获取 Criterion Collection CSV 数据...");
    const response = await Widget.http.get(CRITERION_DATA_URL);
    // 使用内置解析器处理 CSV 文本，并指定第一行为表头
    criterionList = parseCsv(response.data, { headers: true });
    console.log(`成功获取并缓存了 ${criterionList.length} 部 Criterion 电影。`);
}

/**
 * 辅助函数：使用 TMDB API 丰富电影项目列表。
 * @param {Array<object>} items - 从 Criterion 列表截取的当前页电影数组。
 * @returns {Promise<Array<object>>} - 返回附加了 TMDB 数据的新数组。
 */
async function enrichItemsWithTmdb(items) {
    const promises = items.map(item => {
        let params = {
            query: encodeURIComponent(item.title),
            year: item.year
        };
        let api = "/search/movie";

        return Widget.tmdb.get(api, { params: params }).then(response => {
            if (!response) {
                throw new Error("获取数据失败");
            }
            // console.log(response);
            const data = response.results;
            if (data && data.length > 0) {
                return {...item, tmdbData: data[0] };
            }
            // const searchResults = JSON.parse(JSON.stringify(response.data));
            // if (searchResults && searchResults.results && searchResults.results.length > 0) {
            //     return {...item, tmdbData: searchResults.results[0] }; // 正确：返回数组的第一个元素
            // }
            return {...item, tmdbData: null };
        }).catch(error => {
            console.error(`为 "${item.title}" 获取 TMDB 数据失败:`, error);
            return {...item, tmdbData: null };
        });
    });
    return Promise.all(promises);
}

/**
 * 辅助函数：将聚合后的数据映射为 Forward 框架的数据模型。
 * @param {Array<object>} enrichedItems - 包含 Criterion 和 TMDB 数据的电影数组。
 * @returns {Array<object>} - 符合 Forward 规范的对象数组。
 */
function mapToForwardDataModel(enrichedItems) {
    // 这里会过滤tmdb为null的部分，单可能会导致单个page数据小于20，我觉得是可以接受的
    return enrichedItems.filter(item => item !== null).map(item => {
        console.log(item);
        return {
            id: item.id,
            type: "tmdb",
            title: item.title ?? item.name,
            description: item.overview,
            releaseDate: item.release_date ?? item.first_air_date,
            backdropPath: item.backdrop_path,
            posterPath: item.poster_path,
            rating: item.vote_average,
            mediaType: "movie",
        };
    });
}

/**
 * 一个简单的 CSV 解析函数
 * @param {string} str - 要解析的 CSV 字符串
 * @param {object} [opts={}] - 解析选项
 * @param {boolean} [opts.headers=false] - 第一行是否为表头。如果为 true，则返回对象数组。
 * @returns {Array<Array<string>>|Array<Object>}
 */
function parseCsv(str, opts = {}) {
    // 关键修复：如果字符串以BOM字符开头，则移除它
    if (str.charCodeAt(0) === 0xFEFF) {
        str = str.slice(1);
    }
    // 修正 #1: 初始化为空数组
    const arr = [];
    let quote = false;
    let row = 0, col = 0, c = 0;

    for (; c < str.length; c++) {
        const cc = str[c], nc = str[c + 1];

        // 修正 #2: 当行不存在时，初始化为空数组
        arr[row] = arr[row] || [];

        // 修正 #3: 当列不存在时，初始化为空字符串
        arr[row][col] = arr[row][col] || '';

        // 处理转义的双引号 ""
        if (cc === '"' && quote && nc === '"') {
            arr[row][col] += cc;
            ++c;
            continue;
        }

        // 处理普通的双引号
        if (cc === '"') {
            quote = !quote;
            continue;
        }

        // 处理逗号分隔符
        if (cc === ',' && !quote) {
            ++col;
            continue;
        }

        // 修正 #4: 处理换行符，使用正确的 || 操作符
        if ((cc === '\r' && nc === '\n' && !quote) || (cc === '\n' && !quote) || (cc === '\r' && !quote)) {
            ++row;
            col = 0;
            // 如果是 \r\n，则多跳过一个字符
            if (cc === '\r' && nc === '\n') ++c;
            continue;
        }

        arr[row][col] += cc;
    }

    if (opts.headers) {
        // 逻辑修正: header 应该是第一行，rest 是剩余的行
        const header = arr[0];
        const dataRows = arr.slice(1);

        return dataRows.map(r => {
            return r.reduce((acc, v, i) => {
                // 使用 header 数组中的值作为 key
                const key = header[i] ? header[i].trim() : `col_${i}`;
                acc[key] = v ? v.trim() : '';
                return acc;
            }, {});
        });
    }

    return arr;
}
