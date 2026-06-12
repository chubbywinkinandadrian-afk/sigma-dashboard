#include "UI/AV_GameHUD.h"
#include "Characters/AV_PlayerCharacter.h"
#include "Components/AV_HealthComponent.h"
#include "Components/AV_StaminaComponent.h"
#include "Components/AV_LockOnComponent.h"
#include "Components/AV_InteractionComponent.h"
#include "Interfaces/AV_Targetable.h"
#include "Core/AV_PlayerController.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "Engine/Font.h"

void AAV_GameHUD::DrawHUD()
{
	Super::DrawHUD();

	const AAV_PlayerCharacter* Player = Cast<AAV_PlayerCharacter>(GetOwningPawn());
	if (!Player || !Canvas)
	{
		return;
	}

	const AAV_PlayerController* PC = Cast<AAV_PlayerController>(GetOwningPlayerController());
	const bool bUMGHudActive = PC && PC->GetHUDWidget() != nullptr;

	UFont* Small = GEngine->GetSmallFont();
	UFont* Medium = GEngine->GetMediumFont();
	UFont* Large = GEngine->GetLargeFont();

	if (!Player->IsAlive())
	{
		if (!PC || !PC->HasDeathScreenWidget())
		{
			DrawDeathOverlay();
		}
		return;
	}

	if (!bUMGHudActive)
	{
		// Top-left vitals.
		DrawBar(40.f, 40.f, 380.f, 16.f, Player->GetHealthComponent()->GetHealthPercent(), HealthColor);
		DrawBar(40.f, 62.f, 300.f, 11.f, Player->GetStaminaComponent()->GetStaminaPercent(), StaminaColor);

		const FString FlaskText = FString::Printf(TEXT("Ashen Flask  %d / %d"),
			Player->GetFlaskCharges(), Player->GetMaxFlaskCharges());
		DrawText(FlaskText, TextColor, 40.f, 84.f, Medium);

		// Ash counter, bottom-right.
		const FString AshText = FString::Printf(TEXT("Ash  %d"), Player->GetAshCount());
		float AshW, AshH;
		GetTextSize(AshText, AshW, AshH, Medium);
		DrawText(AshText, TextColor, Canvas->SizeX - AshW - 48.f, Canvas->SizeY - AshH - 44.f, Medium);

		// Interaction prompt, lower center.
		const FText Prompt = Player->GetInteractionComponent()->GetFocusedPromptText();
		if (!Prompt.IsEmpty())
		{
			DrawCenteredText(FString::Printf(TEXT("[F]  %s"), *Prompt.ToString()),
				Canvas->SizeX * 0.5f, Canvas->SizeY * 0.78f, TextColor, Medium, 1.f);
		}
	}

	// Lock-on reticle (drawn even with UMG active until the WBP adds its own).
	if (AActor* Target = Player->GetLockOnComponent()->GetCurrentTarget())
	{
		if (Target->Implements<UAV_Targetable>())
		{
			const FVector Projected = Project(IAV_Targetable::Execute_GetTargetPoint(Target));
			if (Projected.Z > 0.f) // in front of the camera
			{
				const float Size = 7.f;
				const FLinearColor Reticle(0.9f, 0.85f, 0.7f);
				DrawLine(Projected.X - Size, Projected.Y, Projected.X, Projected.Y - Size, Reticle, 2.f);
				DrawLine(Projected.X, Projected.Y - Size, Projected.X + Size, Projected.Y, Reticle, 2.f);
				DrawLine(Projected.X + Size, Projected.Y, Projected.X, Projected.Y + Size, Reticle, 2.f);
				DrawLine(Projected.X, Projected.Y + Size, Projected.X - Size, Projected.Y, Reticle, 2.f);
			}
		}
	}
}

void AAV_GameHUD::DrawBar(float X, float Y, float Width, float Height, float Percent, const FLinearColor& FillColor)
{
	DrawRect(BarBackColor, X - 2.f, Y - 2.f, Width + 4.f, Height + 4.f);
	DrawRect(FillColor, X, Y, Width * FMath::Clamp(Percent, 0.f, 1.f), Height);
}

void AAV_GameHUD::DrawCenteredText(const FString& Text, float CenterX, float Y, const FLinearColor& Color, UFont* Font, float Scale)
{
	float TextW, TextH;
	GetTextSize(Text, TextW, TextH, Font, Scale);
	DrawText(Text, Color, CenterX - TextW * 0.5f, Y, Font, Scale);
}

void AAV_GameHUD::DrawDeathOverlay()
{
	DrawRect(FLinearColor(0.f, 0.f, 0.f, 0.75f), 0.f, 0.f, Canvas->SizeX, Canvas->SizeY);
	DrawCenteredText(TEXT("YOU ARE FORGOTTEN"),
		Canvas->SizeX * 0.5f, Canvas->SizeY * 0.45f,
		FLinearColor(0.78f, 0.74f, 0.66f), GEngine->GetLargeFont(), 2.2f);
}
