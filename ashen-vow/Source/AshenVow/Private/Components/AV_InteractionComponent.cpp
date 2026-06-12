#include "Components/AV_InteractionComponent.h"
#include "Interfaces/AV_Interactable.h"
#include "EngineUtils.h"
#include "Engine/World.h"

UAV_InteractionComponent::UAV_InteractionComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.TickInterval = 0.1f; // 10 Hz scan is plenty for prompts
}

void UAV_InteractionComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
	UpdateFocus();
}

void UAV_InteractionComponent::TryInteract()
{
	AActor* Owner = GetOwner();
	if (FocusedInteractable && Owner && IAV_Interactable::Execute_CanInteract(FocusedInteractable, Owner))
	{
		IAV_Interactable::Execute_Interact(FocusedInteractable, Owner);
	}
}

void UAV_InteractionComponent::UpdateFocus()
{
	AActor* Owner = GetOwner();
	UWorld* World = GetWorld();
	if (!Owner || !World)
	{
		return;
	}

	const FVector OwnerLocation = Owner->GetActorLocation();
	const FVector OwnerForward = Owner->GetActorForwardVector();
	const float MinDot = FMath::Cos(FMath::DegreesToRadians(FacingHalfAngle));

	AActor* Best = nullptr;
	float BestDistSq = FMath::Square(InteractRange);

	for (TActorIterator<AActor> It(World); It; ++It)
	{
		AActor* Candidate = *It;
		if (Candidate == Owner || !Candidate->Implements<UAV_Interactable>())
		{
			continue;
		}
		if (!IAV_Interactable::Execute_CanInteract(Candidate, Owner))
		{
			continue;
		}

		const FVector ToCandidate = Candidate->GetActorLocation() - OwnerLocation;
		const float DistSq = ToCandidate.SizeSquared();
		if (DistSq > BestDistSq)
		{
			continue;
		}

		const float FacingDot = FVector::DotProduct(OwnerForward, ToCandidate.GetSafeNormal());
		if (FacingDot < MinDot)
		{
			continue;
		}

		BestDistSq = DistSq;
		Best = Candidate;
	}

	if (Best != FocusedInteractable)
	{
		FocusedInteractable = Best;
		FocusedPromptText = Best ? IAV_Interactable::Execute_GetInteractionText(Best) : FText::GetEmpty();
		OnFocusedInteractableChanged.Broadcast(FocusedInteractable, FocusedPromptText);
	}
}
