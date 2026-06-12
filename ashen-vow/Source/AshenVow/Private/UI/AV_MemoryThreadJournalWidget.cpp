#include "UI/AV_MemoryThreadJournalWidget.h"
#include "Core/AV_PlayerController.h"

TArray<FAV_MemoryThreadEntry> UAV_MemoryThreadJournalWidget::GetMemoryThreadEntries() const
{
	if (const UGameInstance* GameInstance = GetGameInstance())
	{
		if (const UAV_MemoryThreadSubsystem* Threads = GameInstance->GetSubsystem<UAV_MemoryThreadSubsystem>())
		{
			return Threads->GetEntries();
		}
	}
	return {};
}

void UAV_MemoryThreadJournalWidget::CloseJournal()
{
	if (AAV_PlayerController* PC = Cast<AAV_PlayerController>(GetOwningPlayer()))
	{
		PC->ToggleJournal();
	}
}
