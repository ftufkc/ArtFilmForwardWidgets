# ArtFilmForwardWidgets

## 显示效果

![ ](https://raw.githubusercontent.com/ftufkc/ArtFilmForwardWidgets/refs/heads/main/assert/IMG_8623.PNG)

## 引用地址

https://raw.githubusercontent.com/ftufkc/ArtFilmForwardWidgets/refs/heads/main/widgets.fwd

## 数据源

CC：https://github.com/arrismo/criterioncollection/blob/main/data-raw/criterion.csv

TSPDT：https://www.theyshootpictures.com/gf1000_all1000films_table.php

MUBI：https://mubi.com/en/hk/collections/mubi-top-1000

注：这三个数据源具有一定差异性

TSPDT官方提供全量CSV下载，MUBI使用自己的爬虫脚本调用/the-top-1000/list_films进行分页爬取，所以这俩在抓取时可以理解成数据是完整的。

CC并没有官方的接口维护全量列表，因此使用GitHub上的数据集，其原始记录数：1716，过滤spine为NA后有效记录数：1252

## 处理逻辑

### v0.0.1

模块采用分页的形式调用TMDB的/search/movie并传递上述数据源中的英文片名title与发行年份year参数，查询影片信息，并取查询结果的第一位作为最终结果。如果查询结果为null，则舍弃这条数据。

缺点：由于分页由用户在模块中下滑出发，因此每次触发分页时均会并发调用TMDB的/search/movie接口，然后再根据查询到的信息下载电影封面，这样会导致用户等待时间较长。

### v0.0.2

模块按Forward所需格式，将所有数据调用TMDB查询接口预处理好并嵌入模块中，用户只要完成模块加载后，后续翻页丝般顺滑且无需再重新/search/movie。

优点：速度快，用户使用流畅

注：由于上述数据源均为提供良好的数据接入模式，因此很难做到实时更新。后续可考虑使用GitHub action的形式或其他自动化方式进行数据定时拉取，自动预处理与模块定时更新，这样对用户来说也是较为无感的方式。

需要注意的，根据实验结果来看，模块返回的时候数据仅供模块页面渲染使用，点进具体film进行多emby服务器聚合查找时，forward会根据数据源中的tmdb.id重新查询影片信息，所以最终搜索结果的评分与影片信息为TMDB最新信息。



