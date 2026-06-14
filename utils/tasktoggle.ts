const doneDateRegex = / ?✅ *\d{4}-\d{2}-\d{2}/u;
const taskLineRegex = /^(\s*(?:[-*]|\d+\.)\s+\[)(.)(\]\s+.*)$/u;

export function toggleTaskLineDone(line: string, today: string) {
	const match = line.match(taskLineRegex);
	if (!match) return line;

	const [, beforeMarker, marker, afterMarker] = match;
	if (marker === "x") {
		return `${beforeMarker} ${afterMarker.replace(doneDateRegex, "")}`;
	}

	const lineWithDoneMarker = `${beforeMarker}x${afterMarker}`;
	return doneDateRegex.test(lineWithDoneMarker) ? lineWithDoneMarker : `${lineWithDoneMarker} ✅ ${today}`;
}

export function toggleTaskInContent(content: string, lineNumber: number, today: string) {
	const newline = content.includes("\r\n") ? "\r\n" : "\n";
	const lines = content.split(/\r?\n/);
	if (lineNumber < 0 || lineNumber >= lines.length) return content;

	lines[lineNumber] = toggleTaskLineDone(lines[lineNumber], today);
	return lines.join(newline);
}
