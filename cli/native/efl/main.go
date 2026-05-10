package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

type serverState struct {
	Port  int    `json:"port"`
	Token string `json:"token"`
}

type commandRequest struct {
	Args []string          `json:"args"`
	Cwd  string            `json:"cwd"`
	Env  map[string]string `json:"env"`
}

type commandResponse struct {
	Stdout   string `json:"stdout"`
	Stderr   string `json:"stderr"`
	ExitCode int    `json:"exitCode"`
}

var forwardedEnv = []string{
	"EFFORTLESS_TASK",
	"EFFORTLESS_RUN_ID",
	"EFFORTLESS_RUN_LABEL",
	"EFFORTLESS_EFFORT",
	"CODEX_THREAD_ID",
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	state, err := readServerState()
	if err != nil {
		return err
	}

	cwd, err := os.Getwd()
	if err != nil {
		return err
	}

	result, err := runCommand(state, cwd, os.Args[1:])
	if err != nil {
		return err
	}

	printResult(result)

	os.Exit(result.ExitCode)
	return nil
}

func runCommand(state serverState, cwd string, args []string) (commandResponse, error) {
	if len(args) >= 2 && args[0] == "input" && args[1] == "request" && !hasArg(args, "--no-wait") {
		requestArgs := append([]string{}, args...)
		requestArgs = append(requestArgs, "--no-wait")
		result, err := postCommand(state, commandRequest{Args: requestArgs, Cwd: cwd, Env: collectEnv()})
		if err != nil || result.ExitCode != 0 {
			return result, err
		}
		printResult(result)
		inputRef := firstField(result.Stdout)
		if inputRef == "" {
			return commandResponse{ExitCode: 1, Stderr: "Could not determine input ref from input request output."}, nil
		}
		return waitForInput(state, cwd, inputRef)
	}

	if len(args) >= 2 && args[0] == "input" && args[1] == "wait" {
		inputRef := optionValue(args, "--input")
		if inputRef == "" {
			return commandResponse{ExitCode: 1, Stderr: "input wait requires --input"}, nil
		}
		return waitForInput(state, cwd, inputRef)
	}

	if len(args) >= 2 && args[0] == "task" && args[1] == "ready" {
		env := collectEnv()
		env["EFFORTLESS_CLIENT_WAIT"] = "1"
		result, err := postCommand(state, commandRequest{Args: args, Cwd: cwd, Env: env})
		if err != nil || result.ExitCode != 0 {
			return result, err
		}
		printResult(result)
		taskRef := optionValue(args, "--task")
		if taskRef == "" {
			taskRef = firstField(result.Stdout)
		}
		return waitForTask(state, cwd, taskRef)
	}

	if len(args) >= 2 && args[0] == "task" && args[1] == "wait" {
		taskRef := optionValue(args, "--task")
		if taskRef == "" {
			taskRef = os.Getenv("EFFORTLESS_TASK")
		}
		if taskRef == "" {
			return commandResponse{ExitCode: 1, Stderr: "task wait requires --task or EFFORTLESS_TASK"}, nil
		}
		return waitForTask(state, cwd, taskRef)
	}

	return postCommand(state, commandRequest{
		Args: args,
		Cwd:  cwd,
		Env:  collectEnv(),
	})
}

func waitForInput(state serverState, cwd string, inputRef string) (commandResponse, error) {
	started := time.Now()
	for {
		result, err := postCommand(state, commandRequest{
			Args: []string{"input", "show", "--input", inputRef},
			Cwd:  cwd,
			Env:  collectEnv(),
		})
		if err != nil || result.ExitCode != 0 {
			return result, err
		}
		if strings.Contains(firstLine(result.Stdout), " answered") {
			if answer := inputAnswer(result.Stdout); answer != "" {
				return commandResponse{Stdout: answer, ExitCode: 0}, nil
			}
			return result, nil
		}
		fmt.Fprintf(os.Stdout, "waiting for human input, please wait - %d seconds elapsed\n", int(time.Since(started).Seconds()))
		time.Sleep(2 * time.Second)
	}
}

func waitForTask(state serverState, cwd string, taskRef string) (commandResponse, error) {
	started := time.Now()
	for {
		result, err := postCommand(state, commandRequest{
			Args: []string{"task", "show", "--task", taskRef},
			Cwd:  cwd,
			Env:  collectEnv(),
		})
		if err != nil || result.ExitCode != 0 {
			return result, err
		}
		line := firstLine(result.Stdout)
		if strings.Contains(line, " accepted") || strings.Contains(line, " merged") {
			return commandResponse{Stdout: taskRef + " approved", ExitCode: 0}, nil
		}
		if strings.Contains(line, " changes-requested") {
			return commandResponse{Stderr: result.Stdout, ExitCode: 1}, nil
		}
		if !strings.Contains(line, " reviewing") {
			return result, nil
		}
		fmt.Fprintf(os.Stdout, "waiting for human input, please wait - %d seconds elapsed\n", int(time.Since(started).Seconds()))
		time.Sleep(2 * time.Second)
	}
}

func printResult(result commandResponse) {
	if result.Stdout != "" {
		fmt.Fprint(os.Stdout, result.Stdout)
		if result.Stdout[len(result.Stdout)-1] != '\n' {
			fmt.Fprintln(os.Stdout)
		}
	}
	if result.Stderr != "" {
		fmt.Fprint(os.Stderr, result.Stderr)
		if result.Stderr[len(result.Stderr)-1] != '\n' {
			fmt.Fprintln(os.Stderr)
		}
	}
}

func firstField(value string) string {
	line := firstLine(value)
	if line == "" {
		return ""
	}
	return strings.Fields(line)[0]
}

func firstLine(value string) string {
	for _, line := range strings.Split(value, "\n") {
		line = strings.TrimSpace(line)
		if line != "" {
			return line
		}
	}
	return ""
}

func hasArg(args []string, name string) bool {
	for _, arg := range args {
		if arg == name {
			return true
		}
	}
	return false
}

func optionValue(args []string, name string) string {
	for index, arg := range args {
		if arg == name && index+1 < len(args) {
			return args[index+1]
		}
	}
	return ""
}

func inputAnswer(value string) string {
	for _, line := range strings.Split(value, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "answer ") {
			return strings.TrimPrefix(line, "answer ")
		}
	}
	return ""
}

func readServerState() (serverState, error) {
	statePath, err := serverStatePath()
	if err != nil {
		return serverState{}, err
	}

	data, err := os.ReadFile(statePath)
	if errors.Is(err, os.ErrNotExist) {
		return serverState{}, errors.New("Effortless is not running. Open the app before using efl.")
	}
	if err != nil {
		return serverState{}, err
	}

	var state serverState
	if err := json.Unmarshal(data, &state); err != nil {
		return serverState{}, fmt.Errorf("could not read Effortless command server state: %w", err)
	}
	if state.Port == 0 || state.Token == "" {
		return serverState{}, errors.New("Effortless command server state is incomplete. Restart the app and try again.")
	}

	return state, nil
}

func serverStatePath() (string, error) {
	if home := os.Getenv("EFFORTLESS_HOME"); home != "" {
		return filepath.Join(home, "cli-server.json"), nil
	}

	if runtime.GOOS == "windows" {
		appData := os.Getenv("APPDATA")
		if appData == "" {
			return "", errors.New("APPDATA is not set")
		}
		return filepath.Join(appData, "effortless", "cli-server.json"), nil
	}

	configHome := os.Getenv("XDG_CONFIG_HOME")
	if configHome == "" {
		userHome, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		configHome = filepath.Join(userHome, ".config")
	}
	return filepath.Join(configHome, "effortless", "cli-server.json"), nil
}

func collectEnv() map[string]string {
	env := make(map[string]string)
	for _, name := range forwardedEnv {
		if value, ok := os.LookupEnv(name); ok {
			env[name] = value
		}
	}
	return env
}

func postCommand(state serverState, payload commandRequest) (commandResponse, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return commandResponse{}, err
	}

	request, err := http.NewRequest("POST", fmt.Sprintf("http://127.0.0.1:%d/cli", state.Port), bytes.NewReader(body))
	if err != nil {
		return commandResponse{}, err
	}
	request.Header.Set("Authorization", "Bearer "+state.Token)
	request.Header.Set("Content-Type", "application/json")

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return commandResponse{}, errors.New("Effortless command server is unavailable. Restart the app and try again.")
	}
	defer response.Body.Close()

	responseBody, err := io.ReadAll(response.Body)
	if err != nil {
		return commandResponse{}, err
	}

	if response.StatusCode >= 400 {
		return commandResponse{}, fmt.Errorf("Effortless command server returned %d: %s", response.StatusCode, string(responseBody))
	}

	var result commandResponse
	if err := json.Unmarshal(responseBody, &result); err != nil {
		return commandResponse{}, fmt.Errorf("could not read Effortless command response: %w", err)
	}

	return result, nil
}
