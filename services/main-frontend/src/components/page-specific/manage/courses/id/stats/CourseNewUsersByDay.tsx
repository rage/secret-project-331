// const series = [
//   {
//     name: 'Email',
//     type: 'line',
//     stack: 'Total',
//     areaStyle: {},
//     emphasis: {
//       focus: 'none'
//     },
//     lineStyle: {
//       width: 0
//     },
//     showSymbol: false,
//     data: [120, 132, 101, 134, 90, 230, 210]
//   },
//   {
//     name: 'Union Ads',
//     type: 'line',
//     stack: 'Total',
//     areaStyle: {},
//     emphasis: {
//       focus: 'none'
//     },
//     lineStyle: {
//       width: 0
//     },
//     showSymbol: false,
//     data: [220, 182, 191, 234, 290, 330, 310]
//   },
//   {
//     name: 'Video Ads',
//     type: 'line',
//     stack: 'Total',
//     areaStyle: {},
//     emphasis: {
//       focus: 'none'
//     },
//     lineStyle: {
//       width: 0
//     },
//     showSymbol: false,
//     data: [150, 232, 201, 154, 190, 330, 410]
//   },
//   {
//     name: 'Direct',
//     type: 'line',
//     stack: 'Total',
//     areaStyle: {},
//     emphasis: {
//       focus: 'none'
//     },
//     lineStyle: {
//       width: 0
//     },
//     showSymbol: false,
//     data: [320, 332, 301, 334, 390, 330, 320]
//   },
//   {
//     name: 'Search Engine',
//     type: 'line',
//     stack: 'Total',

//     areaStyle: {},
//     emphasis: {
//       focus: 'none'
//     },
//     lineStyle: {
//       width: 0
//     },
//     showSymbol: false,
//     data: [820, 932, 901, 934, 1290, 1330, 1320]
//   }
// ]

// series.unshift({
//     name: 'Total',
//     type: 'line',
//     // label: {
//     //   show: true,
//     //   position: 'top'
//     // },
//     lineStyle: {
//       width: 0
//     },
//     showSymbol: false,
//     color: "black",
//     data: series[0].data.map((_, i) => series.map(o => o.data[i]).reduce((acc, o) => acc + o , 0))
//   })

// option = {
// tooltip: {
//   trigger: 'axis',
//   axisPointer: {
//     type: 'cross',
//     label: {
//       backgroundColor: '#6a7985'
//     }
//   }
// },
// legend: {
//   data: ['Email', 'Union Ads', 'Video Ads', 'Direct', 'Search Engine']
// },
// grid: {
//   left: '3%',
//   right: '4%',
//   bottom: '3%',
//   containLabel: true,
// },
// xAxis: [
//   {
//     type: 'category',
//     boundaryGap: false,
//     splitLine: {
//       show: true
//     },
//     data: ['2021-01-01', '2021-01-03', '2021-01-04', '2021-01-05', '2021-01-06', '2021-01-07', '2021-01-10'],
//   }
// ],
// yAxis: [
//   {
//     type: 'value'
//   }
// ],
// series: series
// };
