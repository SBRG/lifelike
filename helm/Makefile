HELM_DIR:=$(shell dirname $(realpath $(lastword $(MAKEFILE_LIST))))

.PHONY: helm-lint helm-dependency-update helm-schema-gen helm-docs helm-package helm-install helm-install-single-node


helm-lint: ##@helm Run helm lint on Lifelike chart
	helm lint ${HELM_DIR}/lifelike --strict ${args}

helm-dependency-update: ##@helm Install or update chart dependencies
	helm dependency update ${HELM_DIR}/lifelike ${args}

helm-schema-gen: ##@helm Generate Helm chart values JSON schema
	helm schema-gen ${HELM_DIR}/lifelike/values.yaml > ${HELM_DIR}/lifelike/values.schema.json

helm-docs: ##@helm Generate Helm chart README docs
	helm-docs -c ${HELM_DIR}/lifelike -s file

helm-package: ##@helm Generate Lifelike helm chart package
	helm package ${HELM_DIR}/lifelike --dependency-update --destination ${HELM_DIR} ${args}

namespace:=lifelike
helm-install: ##@helm Install or upgrade Lifelike chart <n=namespace>
	@echo "Executing helm command (copy and modify if needed):\n"
	helm upgrade \
      --namespace ${namespace} \
      --install \
      --create-namespace \
      lifelike ${HELM_DIR}/lifelike \
      ${args}

helm-install-single-node: args:=--values ${HELM_DIR}/lifelike/examples/single-node.yaml
helm-install-single-node: helm-install ##@helm Install or upgrade Lifelike chart using the single-node.yaml example values
