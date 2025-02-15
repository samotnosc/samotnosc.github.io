const map = L.map("map").fitBounds([ [54.836, 18.300],[49.002, 22.859],[50.868, 24.145],[52.837, 14.122]  ]);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
	attribution: 'dane geograficzne: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | dane statystyczne: &copy; <a href="https://bdl.stat.gov.pl/"><abbr title="Główny Urząd Statystyczny">GUS</abbr></a>'
}).addTo(map);

let currentLayer;

function clearMap() {
	if (currentLayer) {
		map.removeLayer(currentLayer);
		currentLayer = null;
	}
}

function createCustomScale(data, numRanges, borderValue) {
	const minValue = Math.min(...data);
	const maxValue = Math.max(...data);
	const minBorderDiff = borderValue - minValue;
	const maxBorderDiff = maxValue - borderValue;
	const valueDiff = Math.max(minBorderDiff, maxBorderDiff);
	const newMinValue = borderValue - valueDiff;
	const newMaxValue = borderValue + valueDiff;
	const lowerScale = d3.scaleQuantize().domain([newMinValue, borderValue]).range(d3.range(1, numRanges + 1));
	const upperScale = d3.scaleQuantize().domain([borderValue, newMaxValue]).range(d3.range(1, numRanges + 1));
	const customScale = function (value) {
		if (value < borderValue) {
			return lowerScale(value);
		} else {
			return upperScale(value) + numRanges;
		}
	};
	customScale.thresholds = function () {
		return [].concat([newMinValue], lowerScale.thresholds(), [borderValue], upperScale.thresholds(), [newMaxValue]);
	};
	return customScale;
}

function plural(num, one, few, many)
{
	const strings = {one: one, few: few, many: many};
	const pr = new Intl.PluralRules('pl-PL');
	return strings[pr.select(num)];
}

function visualizeSexRatio() {
	document.getElementById("dataset-options").innerHTML =
	'<div id="age-filters" class="age-filters" style="margin-top: 10px;">w wieku\n' +
	'<input type="number" id="min-age" step="1" size="2" value="18" min="0" max="90"> –\n' +
	'<input type="number" id="max-age" step="1" size="2" value="35" min="0" max="90"> <span id="years">lat</span></div>';

	Promise.all([
		d3.json("powiaty.geojson"),
		d3.csv("P4254.csv")
	]).then(([geojsonData, csvData]) => {
		const groupedData = d3.group(csvData, d => d.teryt);

		function toolTip(layer) {
			const num = layer.feature.properties.calculated.toFixed(0);
			if(!layer.isPopupOpen()) {
				layer.bindTooltip(`<span class="name">${layer.feature.properties.name}</span><br>
						   ${num} ${plural(num, "kobieta", "kobiety", "kobiet")} na 100 mężczyzn`).openTooltip();
			}
		}

		function setRangeFilter() {
			let values = [];
			const minAgeFilter = +document.getElementById("min-age").value;
			const maxAgeFilter = +document.getElementById("max-age").value;
			groupedData.forEach((entries, x) => {
				let fSum = 0;
				let mSum = 0;
				entries.forEach(entry => {
					const age = +entry.wiek;
					if (age >= minAgeFilter && age <= maxAgeFilter) {
						fSum += +entry.kobiety;
						mSum += +entry.mezczyzni;
					}
				});
				if (mSum !== 0) {
					values.push(100 * fSum / mSum);
				}
			});
			document.getElementById("min-range").value = Math.floor(Math.min(...values));
			document.getElementById("max-range").value = Math.ceil(Math.max(...values));
		}

		function setNewAge() {
			setRangeFilter();
			updateMap();
		}

		function updateMap() {
			let counter = 0;
			const minAgeFilter = +document.getElementById("min-age").value;
			const maxAgeFilter = +document.getElementById("max-age").value;
			const minRangeFilter = +document.getElementById("min-range").value;
			const maxRangeFilter = +document.getElementById("max-range").value;
			let numGrades;
			numGrades = +document.getElementById("grades").value;
			document.getElementById("min-range").max = maxRangeFilter - 1;
			document.getElementById("max-range").min = minRangeFilter + 1;
			document.getElementById("min-age").max = maxAgeFilter;
			document.getElementById("max-age").min = minAgeFilter;
			document.getElementById("years").textContent = plural(maxAgeFilter, "rok", "lata", "lat");
			let calculatedValues = [];
			const processedData = new Map();
			groupedData.forEach((entries, teryt) => {
				let fSum = 0;
				let mSum = 0;
				entries.forEach(entry => {
					const age = +entry.wiek;
					if (age >= minAgeFilter && age <= maxAgeFilter) {
						fSum += +entry.kobiety;
						mSum += +entry.mezczyzni;
					}
				});
				if (mSum !== 0) {
					const calculatedValue = 100 * fSum / mSum;
					calculatedValues.push(calculatedValue);
					processedData.set(teryt, { calculatedValue, fSum: fSum, mSum: mSum });
				}
			});
			let minRange;
			let maxRange;
			let xScale;
			let colors;
			calculatedValues = calculatedValues.filter(val => val >= minRangeFilter && val <= maxRangeFilter).sort((a, b) => a - b);
			minRange = Math.min(...calculatedValues);
			maxRange = Math.max(...calculatedValues);
			if (0 < numGrades) {
				xScale = d3.scaleQuantile().domain(calculatedValues).range(d3.range(1, numGrades + 1));
				if (numGrades === 2) {
					colors = ['#d8b365', '#5ab4ac'];
				} else {
					colors = d3.schemeBrBG[numGrades];
				}
			} else {
				xScale = createCustomScale(calculatedValues, -numGrades,100);
				if (-numGrades === 1) {
					colors = ['#3182bd', '#c51b8a'];
				} else if (-numGrades === 2) {
					colors = ['#3182bd','#9ecae1',
						'#fa9fb5','#c51b8a'];
				} else if (-numGrades === 3) {
					colors = ['#3182bd','#9ecae1','#deebf7',
						'#fde0dd','#fa9fb5','#c51b8a'];
				} else if (-numGrades === 4) {
					colors = ["#08519c", "#3182bd", "#6baed6", "#bdd7e7",
						"#fbb4b9", "#f768a1", "#c51b8a", "#7a0177"];
				} else if (-numGrades === 5) {
					colors = ["#08519c", "#3182bd", "#6baed6", "#9ecae1", "#c6dbef",
						"#fcc5c0", "#fa9fb5", "#f768a1", "#c51b8a", "#7a0177"];
				}
			}

			geojsonData.features.forEach(feature => {
				const teryt = feature.id;
				const data = processedData.get(teryt);

				if (data) {
					feature.properties.fSum = data.fSum;
					feature.properties.mSum = data.mSum;
					feature.properties.calculated = data.calculatedValue;
					feature.properties.grade =
						data.calculatedValue >= minRangeFilter && data.calculatedValue <= maxRangeFilter
							? xScale(data.calculatedValue)
							: null;
				} else {
					feature.properties.fSum = null;
					feature.properties.mSum = null;
					feature.properties.calculated = null;
					feature.properties.grade = null;
				}
			});

			function style(feature) {
				const grade = feature.properties.grade;
				if (grade) {
					counter++;
				}
				return {
					fillColor: grade ? colors[grade - 1] : "#d3d3d3",
					weight: 2,
					opacity: grade ? 1 : 0,
					color: "#000000",
					fillOpacity: grade ? 0.8 : 0,
				};
			}

			function onEachFeature(feature, layer) {
				if (feature.properties && feature.properties.name) {
					const name = feature.properties.name;
					const fNumber = feature.properties.fSum !== null ? feature.properties.fSum : "Brak danych";
					const mNumber = feature.properties.mSum !== null ? feature.properties.mSum : "Brak danych";
					const calculated = feature.properties.calculated !== null ? feature.properties.calculated.toFixed(2) : "Brak danych";
					const grade = feature.properties.grade !== null ? feature.properties.grade : "Brak przedziału";
					if (feature.properties.grade) {
						const filteredData = groupedData.get(feature.id).filter(d => d.wiek >= minAgeFilter && d.wiek <= maxAgeFilter);
						const difference = mNumber - fNumber;
						let surplus;
						if (difference>0) {
							surplus = `<p>Nadwyżka mężczyzn: ${difference}.</p>`;
						} else if (difference<0) {
							surplus = `<p>Nadwyżka kobiet: ${(-difference)}.</p>`;
						} else {
							surplus = '';
						}
						let table = '<table class="sex-ratio"><thead><tr><th>Wiek</th><th>Liczba\nmężczyzn</th><th>Liczba\nkobiet</th></tr></thead><tbody>';
						filteredData.forEach(d => {
							table += `<tr><td>${d.wiek}</td><td>${d.mezczyzni}</td><td>${d.kobiety}</td></tr>`;
						});
						table += `<tr><td><nobr>${minAgeFilter}–${maxAgeFilter}</nobr></td><td>${mNumber}</td><td>${fNumber}</td></tr>`;
						table += '</tbody></table>';
						layer.bindPopup(`
							<span class="title">${name}</span><hr>
							<p>Liczba kobiet na 100 mężczyzn: ${(+calculated).toLocaleString("pl-PL", {minimumFractionDigits: 2, maximumFractionDigits: 2})}.<br>
							Liczba mężczyzn na 100 kobiet: ${(100*mNumber/fNumber).toLocaleString("pl-PL", {minimumFractionDigits: 2, maximumFractionDigits: 2})}.</p>
							${table}
							${surplus}
							<!-- ${grade} -->`);
						layer.bindTooltip(toolTip);
					}
				}
			}
			clearMap();
			currentLayer = L.geoJson(geojsonData, {
				style: style,
				onEachFeature: onEachFeature
			}).addTo(map);
			let ranges;
			if (0 < counter)
			{
				let thresholds;
				if (numGrades > 0) {
					thresholds = [].concat([minRange], xScale.quantiles(), [maxRange]).map(d => d.toFixed(2));
				} else {
					thresholds = xScale.thresholds().map(d => d.toFixed(2));
				}
				ranges = thresholds.reduce((acc, curr, index) => {
					if (index < thresholds.length - 1) {
						acc.push([curr, thresholds[index + 1]]);
					}
					return acc;
				}, []);
			} else {
				ranges = [];
			}
			updateLegend(ranges, colors, `Liczba kobiet na 100 mężczyzn`, counter);
		}

		document.getElementById("min-age").value = 18;
		document.getElementById("max-age").value = 35;
		document.getElementById("min-age").addEventListener("change", setNewAge);
		document.getElementById("min-age").addEventListener("input", setNewAge);
		document.getElementById("max-age").addEventListener("change", setNewAge);
		document.getElementById("max-age").addEventListener("input", setNewAge);
		document.getElementById("min-range").addEventListener("change", updateMap);
		document.getElementById("min-range").addEventListener("input", updateMap);
		document.getElementById("max-range").addEventListener("change", updateMap);
		document.getElementById("max-range").addEventListener("input", updateMap);
		document.getElementById("grades").addEventListener("change", updateMap);
		document.getElementById("grades").addEventListener("input", updateMap);
		setRangeFilter();
		updateMap();
	});
}

function visualizeRatio(csvFile, description, reversed_description, oneF="kobieta", fewF="kobiety", manyF="kobiet", oneM="mężczyzna", fewM="mężczyźni", manyM="mężczyzn") {
	document.getElementById("dataset-options").innerHTML = "";
	Promise.all([
		d3.json("powiaty.geojson"),
		d3.csv(csvFile)
	]).then(([geojsonData, csvData]) => {
		function toolTip(layer) {
			const num = layer.feature.properties.calculated.toFixed(0);
			if(!layer.isPopupOpen()) {
				layer.bindTooltip(`<span class="name">${layer.feature.properties.name}</span><br>
					${num} ${plural(num, oneF, fewF, manyF)} na 100 ${manyM}`).openTooltip();
			}
		}

		function setRangeFilter() {
			let values = [];
			csvData.forEach((entry) => {
				let fSum = +entry.kobiety;
				let mSum = +entry.mezczyzni;
				if (mSum !== 0) {
					values.push(100 * fSum / mSum);
				}
			});
			document.getElementById("min-range").value = Math.floor(Math.min(...values));
			document.getElementById("max-range").value = Math.ceil(Math.max(...values));
		}

		function updateMap() {
			let counter = 0;
			const minRangeFilter = +document.getElementById("min-range").value;
			const maxRangeFilter = +document.getElementById("max-range").value;
			let numGrades;
			numGrades = +document.getElementById("grades").value;
			document.getElementById("min-range").max = maxRangeFilter - 1;
			document.getElementById("max-range").min = minRangeFilter + 1;
			let calculatedValues = [];
			const processedData = new Map();
			csvData.forEach((entry) => {
				const fSum = +entry.kobiety;
				const mSum = +entry.mezczyzni;
				if (mSum !== 0) {
					const calculatedValue = 100 * fSum / mSum;
					calculatedValues.push(calculatedValue);
					processedData.set(entry.teryt, { calculatedValue, fSum: fSum, mSum: mSum });
				}
			});
			let minRange;
			let maxRange;
			let xScale;
			let colors;
			calculatedValues = calculatedValues.filter(val => val >= minRangeFilter && val <= maxRangeFilter).sort((a, b) => a - b);
			minRange = Math.min(...calculatedValues);
			maxRange = Math.max(...calculatedValues);
			if (0 < numGrades) {
				xScale = d3.scaleQuantile().domain(calculatedValues).range(d3.range(1, numGrades + 1));
				if (numGrades === 2) {
					colors = ["#d8b365", "#5ab4ac"];
				} else {
					colors = d3.schemeBrBG[numGrades];
				}
			} else {
				xScale = createCustomScale(calculatedValues, -numGrades,100);
				if (-numGrades === 1) {
					colors = ["#3182bd", "#c51b8a"];
				} else if (-numGrades === 2) {
					colors = ["#3182bd", "#9ecae1", "#fa9fb5", "#c51b8a"];
				} else if (-numGrades === 3) {
					colors = ["#3182bd", "#9ecae1", "#deebf7", "#fde0dd", "#fa9fb5", "#c51b8a"];
				} else if (-numGrades === 4) {
					colors = ["#08519c", "#3182bd", "#6baed6", "#bdd7e7", "#fbb4b9", "#f768a1", "#c51b8a", "#7a0177"];
				} else if (-numGrades === 5) {
					colors = ["#08519c", "#3182bd", "#6baed6", "#9ecae1", "#c6dbef", "#fcc5c0", "#fa9fb5", "#f768a1", "#c51b8a", "#7a0177"];
				}
			}
			geojsonData.features.forEach(feature => {
				const teryt = feature.id;
				const data = processedData.get(teryt);
				if (data) {
					feature.properties.fSum = data.fSum;
					feature.properties.mSum = data.mSum;
					feature.properties.calculated = data.calculatedValue;
					feature.properties.grade =
						data.calculatedValue >= minRangeFilter && data.calculatedValue <= maxRangeFilter
							? xScale(data.calculatedValue)
							: null;
				} else {
					feature.properties.fSum = null;
					feature.properties.mSum = null;
					feature.properties.calculated = null;
					feature.properties.grade = null;
				}
			});

			function style(feature) {
				const grade = feature.properties.grade;
				if (grade) {
					counter++;
				}
				return {
					fillColor: grade ? colors[grade - 1] : "#d3d3d3",
					weight: 2,
					opacity: grade ? 1 : 0,
					color: "#000000",
					fillOpacity: grade ? 0.8 : 0,
				};
			}

			function onEachFeature(feature, layer) {
				if (feature.properties && feature.properties.name) {
					const name = feature.properties.name;
					const fNumber = feature.properties.fSum !== null ? feature.properties.fSum : "Brak danych";
					const mNumber = feature.properties.mSum !== null ? feature.properties.mSum : "Brak danych";
					const calculated = feature.properties.calculated !== null ? feature.properties.calculated.toFixed(2) : "Brak danych";
					const grade = feature.properties.grade !== null ? feature.properties.grade : "Brak przedziału";
					if (feature.properties.grade) {
						const difference = mNumber - fNumber;
						let surplus;
						if (difference>0) {
							surplus = `<p>Nadwyżka ${manyM}: ${difference}.</p>`;
						} else if (difference<0) {
							surplus = `<p>Nadwyżka ${manyF}: ${(-difference)}.</p>`;
						} else {
							surplus = '';
						}
						let table = `<table class="two"><thead><tr><th>Liczba\n${manyM}</th><th>Liczba\n${manyF}</th></tr></thead><tbody>`;
						table += `<tr><td>${mNumber}</td><td>${fNumber}</td></tr>`;
						table += '</tbody></table>';
						layer.bindPopup(`
							<span class="title">${name}</span><hr>
							<p>${description}: ${(+calculated).toLocaleString("pl-PL", {minimumFractionDigits: 2, maximumFractionDigits: 2})}.<br>
							${reversed_description}: ${(100*mNumber/fNumber).toLocaleString("pl-PL", {minimumFractionDigits: 2, maximumFractionDigits: 2})}.</p>
							${table}
							${surplus}
							<!-- ${grade} -->`);
						layer.bindTooltip(toolTip);
					}
				}
			}
			clearMap();
			currentLayer = L.geoJson(geojsonData, {
				style: style,
				onEachFeature: onEachFeature
			}).addTo(map);
			let ranges;
			if (0 < counter) {
				let thresholds;
				if (numGrades > 0) {
					thresholds = [].concat([minRange], xScale.quantiles(), [maxRange]).map(d => d.toFixed(2));
				} else {
					thresholds = xScale.thresholds().map(d => d.toFixed(2));
				}
				ranges = thresholds.reduce((acc, curr, index) => {
					if (index < thresholds.length - 1) {
						acc.push([curr, thresholds[index + 1]]);
					}
					return acc;
				}, []);
			} else {
				ranges = [];
			}
			updateLegend(ranges, colors, description, counter);
		}

		document.getElementById("min-range").addEventListener("change", updateMap);
		document.getElementById("min-range").addEventListener("input", updateMap);
		document.getElementById("max-range").addEventListener("change", updateMap);
		document.getElementById("max-range").addEventListener("input", updateMap);
		document.getElementById("grades").addEventListener("change", updateMap);
		document.getElementById("grades").addEventListener("input", updateMap);
		setRangeFilter();
		updateMap();
	});
}

function updateLegend(grades, colors, description = "Zakresy", counter = 0) {
	const legendContainer = document.getElementById("legend");
	legendContainer.innerHTML = "";
	const counterSpan = document.getElementById("element-counter");
	counterSpan.innerHTML = `${counter}`;
	const powiat = document.getElementById("powiat");
	powiat.innerHTML = plural(counter, "powiat", "powiaty", "powiatów");
	grades.forEach((range, i) => {
		const legendItem = document.createElement("div");
		const colorBox = document.createElement("div");
		const label = document.createElement("span");
		legendItem.className = "legend-item";
		colorBox.className = "legend-color";
		colorBox.style.backgroundColor = colors[i];
		colorBox.title = colors[i];
		label.textContent = `${(+range[0]).toLocaleString("pl-PL", {minimumFractionDigits: 2, maximumFractionDigits: 2})} – ${(+range[1]).toLocaleString("pl-PL", {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
		legendItem.appendChild(colorBox);
		legendItem.appendChild(label);
		legendContainer.appendChild(legendItem);
	});
}

document.getElementById("dataset-select").addEventListener("change", (e) => {
	const selectedOption = e.target.value;
	if (selectedOption === "sex-ratio") visualizeSexRatio();
	else if (selectedOption === "unmarried-ratio") visualizeRatio("P4286.csv", "Liczba panien na 100 kawalerów", "Liczba kawalerów na 100 panien", "panna", "panny", "panien", "kawaler", "kawalerowie", "kawalerów");
	else if (selectedOption === "higher-education-ratio") visualizeRatio("P4315.csv", "Liczba kobiet z wyższym wykształceniem na 100 mężczyzn z wyższym wykształceniem", "Liczba mężczyzn z wyższym wykształceniem na 100 kobiet z wyższym wykształceniem");
});

visualizeSexRatio();
