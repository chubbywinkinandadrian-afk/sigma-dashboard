#include "Characters/AV_ElyaNPC.h"
#include "Characters/AV_PlayerCharacter.h"
#include "Components/AV_VowComponent.h"
#include "Systems/AV_MemoryThreadSubsystem.h"
#include "Systems/AV_WorldStateSubsystem.h"

AAV_ElyaNPC::AAV_ElyaNPC()
{
	NpcId = FName("Elya");
	NpcDisplayName = NSLOCTEXT("AshenVow", "Elya", "Elya");

	FAV_DialogueLine Line1;
	Line1.Text = NSLOCTEXT("AshenVow", "Elya1",
		"You woke with no vow. That is why they will fear you.");

	FAV_DialogueLine Line2;
	Line2.Text = NSLOCTEXT("AshenVow", "Elya2",
		"Most people here are held together by promises. You are held together by absence.");

	FAV_DialogueLine Line3;
	Line3.Text = NSLOCTEXT("AshenVow", "Elya3",
		"The White Sun does not give light. It takes memory.");
	Line3.MemoryThreadId = FName("MT_Elya_WhiteSun");
	Line3.MemoryThreadText = NSLOCTEXT("AshenVow", "MT_WhiteSun",
		"Elya said the White Sun does not give light. It takes memory.");

	FAV_DialogueLine Line4;
	Line4.Text = NSLOCTEXT("AshenVow", "Elya4",
		"Reach the gate. Ring the dead bell. Then perhaps the capital will remember you.");

	FAV_DialogueLine Line5;
	Line5.Text = NSLOCTEXT("AshenVow", "Elya5",
		"Take this fragment. A promise small enough to carry — and to put down, at any altar.");

	FirstMeetingLines = { Line1, Line2, Line3, Line4, Line5 };

	FAV_DialogueLine Repeat1;
	Repeat1.Text = NSLOCTEXT("AshenVow", "ElyaRepeat1",
		"The gate still waits. So does the knight who forgot his own name.");
	Repeat1.MemoryThreadId = FName("MT_GateKnight");
	Repeat1.MemoryThreadText = NSLOCTEXT("AshenVow", "MT_GateKnight",
		"The gate knight still guards an empty throne.");

	RepeatLines = { Repeat1 };
}

void AAV_ElyaNPC::HandleDialogueEnded(AAV_PlayerCharacter* Player)
{
	const bool bFirstConversation = !HasMetPlayer();
	Super::HandleDialogueEnded(Player); // sets the met flag

	if (!bFirstConversation || !Player)
	{
		return;
	}

	if (UAV_VowComponent* VowComponent = Player->GetVowComponent())
	{
		VowComponent->GrantVow(FirstVowGrant);
	}

	if (UGameInstance* GameInstance = GetGameInstance())
	{
		if (UAV_MemoryThreadSubsystem* Threads = GameInstance->GetSubsystem<UAV_MemoryThreadSubsystem>())
		{
			Threads->AddEntry(FName("MT_FirstVow"), NSLOCTEXT("AshenVow", "MT_FirstVow",
				"A Vow gives shape to the soul, but also chains it."));
		}
	}
}
