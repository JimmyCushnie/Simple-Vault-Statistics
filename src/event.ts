// Me: can we have C#?
// Mom: we have C# at home
// C# at home:
export class Event {
	private readonly listeners = new Set<() => void>();

	addListener(listener: () => void): void {
		this.listeners.add(listener);
	}

	removeListener(listener: () => void): void {
		this.listeners.delete(listener);
	}

	invoke(): void {
		for (const listener of this.listeners) {
			listener();
		}
	}
}
