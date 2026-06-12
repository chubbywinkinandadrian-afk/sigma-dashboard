#include "Systems/AV_MemoryThreadSubsystem.h"

bool UAV_MemoryThreadSubsystem::AddEntry(FName EntryId, FText Text)
{
	if (EntryId == NAME_None || HasEntry(EntryId))
	{
		return false;
	}

	FAV_MemoryThreadEntry Entry;
	Entry.EntryId = EntryId;
	Entry.Text = Text;
	Entry.Order = Entries.Num();
	Entries.Add(Entry);

	OnMemoryThreadAdded.Broadcast(Entry);
	return true;
}

bool UAV_MemoryThreadSubsystem::HasEntry(FName EntryId) const
{
	return Entries.ContainsByPredicate(
		[EntryId](const FAV_MemoryThreadEntry& Entry) { return Entry.EntryId == EntryId; });
}

void UAV_MemoryThreadSubsystem::RestoreEntries(const TArray<FAV_MemoryThreadEntry>& SavedEntries)
{
	Entries = SavedEntries;
}
