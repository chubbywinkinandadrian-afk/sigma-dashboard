#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "Dialogue/AV_DialogueTypes.h"
#include "Systems/AV_MemoryThreadSubsystem.h"
#include "Vow/AV_VowTypes.h"
#include "AV_PlayerController.generated.h"

class UUserWidget;
class UAV_HUDWidget;
class UAV_DialogueWidget;
class UAV_MemoryThreadJournalWidget;
class UAV_AltarMenuWidget;
class AAV_NPCBase;
class AAV_AshenAltar;

/**
 * Owns all UI sessions: HUD, death screen, dialogue, Memory Thread journal,
 * and the Ashen Altar menu. While any modal UI is open, IsUIBlockingGameplay()
 * is true and the player character ignores combat/movement input.
 * Assign the widget classes in BP_AVPlayerController; every feature degrades
 * gracefully when its widget class is unset (e.g. altars rest directly).
 */
UCLASS()
class ASHENVOW_API AAV_PlayerController : public APlayerController
{
	GENERATED_BODY()

public:
	// ---- Death screen ----
	void ShowDeathScreen();
	void HideDeathScreen();

	// ---- Dialogue ----
	void StartDialogue(AAV_NPCBase* NPC);

	UFUNCTION(BlueprintCallable, Category = "AshenVow|Dialogue")
	void AdvanceDialogue();

	UFUNCTION(BlueprintCallable, Category = "AshenVow|Dialogue")
	void EndDialogue();

	UFUNCTION(BlueprintPure, Category = "AshenVow|Dialogue")
	FText GetCurrentDialogueSpeaker() const;

	UFUNCTION(BlueprintPure, Category = "AshenVow|Dialogue")
	FText GetCurrentDialogueLineText() const;

	// ---- Altar menu ----
	void OpenAltarMenu(AAV_AshenAltar* Altar);

	UFUNCTION(BlueprintCallable, Category = "AshenVow|Altar")
	void CloseAltarMenu();

	UFUNCTION(BlueprintPure, Category = "AshenVow|Altar")
	AAV_AshenAltar* GetMenuAltar() const { return MenuAltar; }

	/** True if no altar-menu widget class is assigned (altar then rests directly). */
	bool ShouldAltarRestDirectly() const { return !AltarMenuWidgetClass; }

	// ---- Journal ----
	UFUNCTION(BlueprintCallable, Category = "AshenVow|Journal")
	void ToggleJournal();

	// ---- State ----
	/** True while dialogue/journal/altar menu (or death) is up — gameplay input is ignored. */
	UFUNCTION(BlueprintPure, Category = "AshenVow|UI")
	bool IsUIBlockingGameplay() const;

	UFUNCTION(BlueprintPure, Category = "AshenVow|UI")
	UAV_HUDWidget* GetHUDWidget() const { return HUDWidget; }

	/** True once a WBP death screen is assigned — the canvas HUD then skips its overlay. */
	UFUNCTION(BlueprintPure, Category = "AshenVow|UI")
	bool HasDeathScreenWidget() const;

protected:
	virtual void BeginPlay() override;
	virtual void OnPossess(APawn* InPawn) override;

	/** Set to WBP_HUD (child of UAV_HUDWidget). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|UI")
	TSubclassOf<UAV_HUDWidget> HUDWidgetClass;

	/** Set to WBP_DeathScreen ("YOU ARE FORGOTTEN"). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|UI")
	TSubclassOf<UUserWidget> DeathScreenClass;

	/** Set to WBP_DialogueBox (child of UAV_DialogueWidget). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|UI")
	TSubclassOf<UAV_DialogueWidget> DialogueWidgetClass;

	/** Set to WBP_MemoryThreadJournal (child of UAV_MemoryThreadJournalWidget). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|UI")
	TSubclassOf<UAV_MemoryThreadJournalWidget> JournalWidgetClass;

	/** Set to WBP_AshenAltarMenu (child of UAV_AltarMenuWidget). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|UI")
	TSubclassOf<UAV_AltarMenuWidget> AltarMenuWidgetClass;

private:
	void ProcessCurrentDialogueLine();

	/** Tear down dialogue without firing end-of-conversation rewards (death). */
	void CancelDialogue();

	void SetUIInputMode(bool bUIOpen);

	UFUNCTION()
	void HandleMemoryThreadAdded(const FAV_MemoryThreadEntry& Entry);

	UFUNCTION()
	void HandleVowUnlocked(const FAV_VowDefinition& Vow);

	UFUNCTION()
	void HandleVowEquipped(const FAV_VowDefinition& Vow);

	UPROPERTY()
	TObjectPtr<UAV_HUDWidget> HUDWidget = nullptr;

	UPROPERTY()
	TObjectPtr<UUserWidget> DeathScreenWidget = nullptr;

	UPROPERTY()
	TObjectPtr<UAV_DialogueWidget> DialogueWidget = nullptr;

	UPROPERTY()
	TObjectPtr<UAV_MemoryThreadJournalWidget> JournalWidget = nullptr;

	UPROPERTY()
	TObjectPtr<UAV_AltarMenuWidget> AltarMenuWidget = nullptr;

	UPROPERTY()
	TObjectPtr<AAV_NPCBase> ActiveDialogueNPC = nullptr;

	UPROPERTY()
	TObjectPtr<AAV_AshenAltar> MenuAltar = nullptr;

	TArray<FAV_DialogueLine> ActiveDialogueLines;
	int32 DialogueLineIndex = 0;
	bool bJournalOpen = false;
	bool bDeathScreenUp = false;
};
