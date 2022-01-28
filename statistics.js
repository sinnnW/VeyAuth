const fs = require("fs");

const blacklistedFolders = [
];

const blacklistedFiles = [
];

var	counters = {
	"lines": 0,
	"files": 0,
	"directories": 0,
	"chars": 0
};

console.log(loadFilesInFolder("./src"));

function loadFilesInFolder(directory)
{
//   if (!fs.existsSync(directory))
	// return shared.error("loadFilesInFolder() main.js", `Unknown directory: ${directory}`);
  
	var paths = directory.split("/");
	for (var x = 0;x < paths.length;x++) {
		if (blacklistedFolders.includes(paths[x]))
		{
			console.log(`Skipping ${directory} (blacklisted directory)`, "statistics.log");
			return;
		}
	}
  var files = fs.readdirSync(directory);
  files.forEach(file => {
	if (fs.statSync(`${directory}/${file}`).isDirectory())
		{
			counters.directories++;
	  return loadFilesInFolder(`${directory}/${file}`);
		} else
		{
			if (blacklistedFiles.includes(file))
			{
				console.log(`Skipping ${directory}/${file} (blacklisted file)`, "statistics.log");
				return;
			} else if (!["js", 'ts', "css", "json", "html"].includes(file.split('.')[file.split('.').length - 1]))
	  {
		console.log(`Skipping ${directory}/${file} (incorrect extension: ${file.split('.')[file.split('.').length - 1]})`, "statistics.log");
		return;
	  }

			counters.files++;
			let content = fs.readFileSync(`${directory}/${file}`).toString();
			counters.chars += content.length;
			counters.lines += content.split("\n").length;
			console.log(`Adding ${counters.lines} lines and ${counters.chars} chars to counter (${directory}/${file})`, "statistics.log");
		}
  });

	return counters;
}